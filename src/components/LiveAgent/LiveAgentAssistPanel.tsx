import { useCallback, useEffect, useRef, useState } from 'react'
import { MonitorUp, PhoneCall, PhoneOff } from 'lucide-react'
import {
  addStreamToPeer,
  attachHandlersToChannel,
  buildPeerConnection,
  categorizeTrack,
  connectSignalingSocket,
  createCameraStream,
  createScreenStream,
  createSignalingSession,
  registerDataChannelHandler,
  stopStream,
  type SignalingMessage,
} from '@ocbc/webrtc-client'
import { createLiveAgentTicket } from '../../lib/live-agent'
import { AnnotationOverlay } from './AnnotationOverlay'
import type { RenderableAnnotation } from './AnnotationOverlay'
import {
  ANNOTATION_CHANNEL_LABEL,
  DEFAULT_ANNOTATION_TTL,
  type AnnotationMessage,
} from '../../types/annotations'
import type { BankingAction } from '../../data/bank-store'

type CallState = 'idle' | 'preparing' | 'connecting' | 'connected' | 'error'

interface LiveAgentAssistPanelProps {
  currentAction: BankingAction | null
  language: string
}

export function LiveAgentAssistPanel({
  currentAction,
  language,
}: LiveAgentAssistPanelProps) {
  const [callState, setCallState] = useState<CallState>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [participantCount, setParticipantCount] = useState(1)
  const [localMedia, setLocalMedia] = useState<{
    camera: MediaStream | null
    screen: MediaStream | null
  }>({ camera: null, screen: null })
  const [remoteFeeds, setRemoteFeeds] = useState<{
    camera: MediaStream | null
    screen: MediaStream | null
  }>({ camera: null, screen: null })
  const [remoteAudioVersion, setRemoteAudioVersion] = useState(0)
  const [annotations, setAnnotations] = useState<RenderableAnnotation[]>([])
  const [annotationsEnabled, setAnnotationsEnabled] = useState(true)

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pendingSignalsRef = useRef<Array<SignalingMessage>>([])
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteScreenRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  const localCameraStreamRef = useRef<MediaStream | null>(null)
  const localScreenStreamRef = useRef<MediaStream | null>(null)
  const remoteCameraStreamRef = useRef<MediaStream | null>(null)
  const remoteScreenStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioStreamRef = useRef<MediaStream | null>(null)
  const annotationChannelRef = useRef<RTCDataChannel | null>(null)
  const lastOfferRef = useRef<RTCSessionDescriptionInit | null>(null)
  const textDecoderRef = useRef<TextDecoder | null>(null)

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localMedia.camera ?? null
    }
  }, [localMedia.camera])

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteFeeds.camera ?? null
    }
  }, [remoteFeeds.camera])

  useEffect(() => {
    if (remoteScreenRef.current) {
      remoteScreenRef.current.srcObject = remoteFeeds.screen ?? null
    }
  }, [remoteFeeds.screen])

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteAudioStreamRef.current ?? null
    }
  }, [remoteAudioVersion])

  useEffect(() => {
    if (annotations.length === 0) {
      return
    }
    const interval = window.setInterval(() => {
      setAnnotations((prev) =>
        prev.filter(
          (annotation) =>
            Date.now() - annotation.createdAt <
            (annotation.ttlMs ?? DEFAULT_ANNOTATION_TTL),
        ),
      )
    }, 2000)
    return () => {
      window.clearInterval(interval)
    }
  }, [annotations.length])

  const sendSignal = useCallback((message: SignalingMessage) => {
    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pendingSignalsRef.current = [...pendingSignalsRef.current, message]
      return
    }
    socket.send(JSON.stringify(message))
  }, [])

  const flushPendingSignals = useCallback(() => {
    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }
    if (pendingSignalsRef.current.length === 0) {
      return
    }
    pendingSignalsRef.current.forEach((message) => {
      socket.send(JSON.stringify(message))
    })
    pendingSignalsRef.current = []
  }, [])

  const cleanupLiveAgent = useCallback(
    (
      reason?: string,
      nextState: CallState = 'idle',
      closeSocket: boolean = true,
    ) => {
      if (closeSocket && wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
      wsRef.current = null

      if (pcRef.current) {
        pcRef.current.onicecandidate = null
        pcRef.current.ontrack = null
        pcRef.current.onconnectionstatechange = null
        pcRef.current.close()
      }
      pcRef.current = null

      if (annotationChannelRef.current) {
        annotationChannelRef.current.onmessage = null
        annotationChannelRef.current.close()
      }
      annotationChannelRef.current = null

      stopStream(localCameraStreamRef.current)
      stopStream(localScreenStreamRef.current)
      stopStream(remoteCameraStreamRef.current)
      stopStream(remoteScreenStreamRef.current)
      stopStream(remoteAudioStreamRef.current)

      localCameraStreamRef.current = null
      localScreenStreamRef.current = null
      remoteCameraStreamRef.current = null
      remoteScreenStreamRef.current = null
      remoteAudioStreamRef.current = null

      setLocalMedia({ camera: null, screen: null })
      setRemoteFeeds({ camera: null, screen: null })
      setRemoteAudioVersion((prev) => prev + 1)
      setParticipantCount(1)
      lastOfferRef.current = null
      setSessionId(null)
      setAnnotations([])
      pendingSignalsRef.current = []

      if (reason) {
        setCallError(reason)
      } else {
        setCallError(null)
      }

      setCallState(nextState)
    },
    [],
  )

  useEffect(() => {
    return () => {
      cleanupLiveAgent()
    }
  }, [cleanupLiveAgent])

  const handleRemoteTrack = useCallback((event: RTCTrackEvent) => {
    const trackType = categorizeTrack(event.track)
    if (trackType === 'audio') {
      if (!remoteAudioStreamRef.current) {
        remoteAudioStreamRef.current = new MediaStream()
      }
      const alreadyAdded = remoteAudioStreamRef.current
        .getTracks()
        .some((track) => track.id === event.track.id)
      if (!alreadyAdded) {
        remoteAudioStreamRef.current.addTrack(event.track)
        setRemoteAudioVersion((prev) => prev + 1)
      }
      return
    }

    if (trackType === 'screen') {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      remoteScreenStreamRef.current = stream
      setRemoteFeeds((prev) => ({ ...prev, screen: stream }))
      return
    }

    const stream = event.streams[0] ?? new MediaStream([event.track])
    remoteCameraStreamRef.current = stream
    setRemoteFeeds((prev) => ({ ...prev, camera: stream }))
  }, [])

  const processAnnotationJson = useCallback((payload: string) => {
    let message: AnnotationMessage | null = null
    try {
      message = JSON.parse(payload) as AnnotationMessage
    } catch (err) {
      console.error('Failed to parse annotation payload', err)
      return
    }

    if (!message) {
      return
    }

    if (message.kind === 'annotation') {
      const ttlMs = message.ttlMs ?? DEFAULT_ANNOTATION_TTL
      const entry: RenderableAnnotation = {
        ...message,
        ttlMs,
        createdAt: Date.now(),
      }
      setAnnotations((prev) => {
        const withoutDuplicate = prev.filter(
          (annotation) => annotation.id !== entry.id,
        )
        return [...withoutDuplicate, entry]
      })
      return
    }

    if (message.kind === 'clear') {
      setAnnotations((prev) =>
        message.targetId
          ? prev.filter((annotation) => annotation.id !== message.targetId)
          : [],
      )
    }
  }, [])

  const handleAnnotationChannelMessage = useCallback(
    (event: MessageEvent) => {
      const data = event.data
      if (typeof data === 'string') {
        processAnnotationJson(data)
        return
      }
      if (data instanceof ArrayBuffer) {
        if (!textDecoderRef.current) {
          textDecoderRef.current = new TextDecoder()
        }
        processAnnotationJson(textDecoderRef.current.decode(data))
        return
      }
      if (data instanceof Blob) {
        data
          .text()
          .then(processAnnotationJson)
          .catch((err) => {
            console.error('Failed to decode annotation blob', err)
          })
      }
    },
    [processAnnotationJson],
  )

  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      if (
        message.type === 'peer-update' &&
        message.payload &&
        'participants' in message.payload
      ) {
        const participants = Number(message.payload.participants)
        if (!Number.isNaN(participants)) {
          setParticipantCount(participants)
          if (
            message.senderRole === 'agent' &&
            participants > 1 &&
            lastOfferRef.current
          ) {
            sendSignal({
              type: 'offer',
              payload: lastOfferRef.current,
            })
          }
        }
        return
      }

      if (message.type === 'heartbeat') {
        return
      }

      if (message.type === 'error') {
        cleanupLiveAgent(
          message.payload?.message ?? 'Signaling error',
          'error',
          false,
        )
        return
      }

      const peer = pcRef.current
      if (!peer) {
        return
      }

      try {
        if (message.type === 'answer') {
          await peer.setRemoteDescription(message.payload)
        } else if (message.type === 'ice') {
          await peer.addIceCandidate(message.payload)
        } else if (message.type === 'hangup') {
          cleanupLiveAgent('Agent ended the session', 'idle', false)
        }
      } catch (err) {
        cleanupLiveAgent(
          err instanceof Error
            ? err.message
            : 'Failed to process signaling message',
          'error',
          false,
        )
      }
    },
    [cleanupLiveAgent, sendSignal],
  )

  const startLiveAgentSession = useCallback(async () => {
    if (callState === 'connecting' || callState === 'preparing') {
      return
    }

    setCallError(null)
    setCallState('preparing')

    try {
      const { sessionId: id, iceServers } = await createSignalingSession()
      if (!id) {
        cleanupLiveAgent(
          'Failed to create signaling session. Please check signaling server connection.',
          'error',
        )
        return
      }
      setSessionId(id)

      try {
        await createLiveAgentTicket({
          sessionId: id,
          atmId: 'VTM-001',
          customerName: 'Walk-up Customer',
          issueType: currentAction?.intent ?? 'Live Agent Request',
          description: currentAction
            ? [
                `Intent: ${currentAction.intent}`,
                currentAction.amount
                  ? `Amount: $${currentAction.amount.toLocaleString()}`
                  : null,
                currentAction.recipient
                  ? `Recipient: ${currentAction.recipient}`
                  : null,
                currentAction.duration
                  ? `Duration: ${currentAction.duration} months`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Customer requested assistance from the kiosk.',
          priority: 'high',
          metadata: {
            language,
            amount: currentAction?.amount,
            recipient: currentAction?.recipient,
            duration: currentAction?.duration,
          },
        })
      } catch (notificationError) {
        console.error('Live agent notification failed', notificationError)
        setCallError(
          notificationError instanceof Error
            ? `Live agent notification failed: ${notificationError.message}`
            : 'Unable to notify live agent dashboard. Please share session code manually.',
        )
      }

      let peer: RTCPeerConnection
      try {
        peer = buildPeerConnection({
          iceServers,
          onIceCandidate: (candidate) => {
            const payload = candidate.toJSON()
            sendSignal({ type: 'ice', payload })
          },
          onTrack: handleRemoteTrack,
          onConnectionStateChange: (state) => {
            if (state === 'connected') {
              setCallState('connected')
            } else if (state === 'failed') {
              cleanupLiveAgent('Peer connection failed', 'error')
            } else if (state === 'disconnected') {
              setCallState('connecting')
            }
          },
        })
      } catch (peerError) {
        const errorMessage =
          peerError instanceof Error ? peerError.message : 'Unknown error'
        cleanupLiveAgent(
          errorMessage.includes('Configuration') ||
            errorMessage.includes('Invalid')
            ? `WebRTC configuration error: ${errorMessage}. Please ensure the signaling server is running at ${import.meta.env.VITE_SIGNALING_HTTP_URL ?? 'https://localhost:4100'}.`
            : `Failed to create peer connection: ${errorMessage}`,
          'error',
        )
        return
      }
      pcRef.current = peer
      registerDataChannelHandler(peer, (event) => {
        if (event.channel.label !== ANNOTATION_CHANNEL_LABEL) {
          return
        }
        annotationChannelRef.current = attachHandlersToChannel(event.channel, {
          onMessage: handleAnnotationChannelMessage,
          onClose: () => {
            annotationChannelRef.current = null
          },
        })
      })

      const cameraStream = await createCameraStream()
      cameraStream
        .getVideoTracks()
        .forEach((track) => (track.contentHint = 'camera'))
      localCameraStreamRef.current = cameraStream
      setLocalMedia((prev) => ({ ...prev, camera: cameraStream }))
      addStreamToPeer(peer, cameraStream)

      let screenStream: MediaStream | null = null
      try {
        screenStream = await createScreenStream()
        screenStream
          .getVideoTracks()
          .forEach((track) => (track.contentHint = 'screen'))
        localScreenStreamRef.current = screenStream
        setLocalMedia((prev) => ({ ...prev, screen: screenStream }))
        if (screenStream) {
          addStreamToPeer(peer, screenStream)
        }
      } catch (err) {
        setCallError(
          'Screen sharing is not available. The live agent will still be able to see your camera feed.',
        )
        setTimeout(() => setCallError(null), 5000)
      }

      setCallState('connecting')

      const socket = connectSignalingSocket({
        sessionId: id,
        role: 'vtm',
        onMessage: handleSignalingMessage,
        onClose: () => {
          cleanupLiveAgent('Signaling channel closed', 'error', false)
        },
        onOpen: async () => {
          flushPendingSignals()
          try {
            const offer = await peer.createOffer()
            await peer.setLocalDescription(offer)
            lastOfferRef.current = offer
            sendSignal({ type: 'offer', payload: offer })
          } catch (err) {
            cleanupLiveAgent(
              err instanceof Error ? err.message : 'Unable to complete offer',
              'error',
            )
          }
        },
      })

      wsRef.current = socket
    } catch (err) {
      cleanupLiveAgent(
        err instanceof Error ? err.message : 'Failed to start live session',
        'error',
      )
    }
  }, [
    callState,
    cleanupLiveAgent,
    currentAction,
    flushPendingSignals,
    handleRemoteTrack,
    handleAnnotationChannelMessage,
    handleSignalingMessage,
    language,
    sendSignal,
  ])

  const endLiveAgentSession = useCallback(() => {
    if (callState === 'idle') {
      return
    }
    sendSignal({ type: 'hangup' })
    cleanupLiveAgent(undefined, 'idle')
  }, [callState, cleanupLiveAgent, sendSignal])

  const statusCopy: Record<CallState, string> = {
    idle: 'Idle',
    preparing: 'Requesting agent',
    connecting: 'Negotiating',
    connected: 'Connected',
    error: 'Error',
  }

  const statusColor: Record<CallState, string> = {
    idle: 'bg-slate-800 text-slate-200',
    preparing: 'bg-amber-500/15 text-amber-100',
    connecting: 'bg-blue-500/15 text-blue-100',
    connected: 'bg-emerald-500/15 text-emerald-100',
    error: 'bg-rose-500/15 text-rose-100',
  }

  const liveAgentCount = Math.max(participantCount - 1, 0)
  const showStartButton =
    callState === 'idle' || callState === 'error' || callState === 'preparing'

  return (
    <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Live agent assist
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Escalate when needed
          </h2>
          <p className="text-sm text-slate-400">
            Share context, video, and annotations with a human agent.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[callState]}`}
        >
          {statusCopy[callState]}
        </span>
      </div>

      <div className="text-sm text-slate-400">
        {sessionId ? (
          <>
            Session <span className="font-mono text-white/90">{sessionId}</span>
          </>
        ) : (
          'No session started'
        )}
      </div>

      {callError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {callError}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <MonitorUp size={16} />
          <span>Agent feed</span>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-2xl shadow-slate-900/40">
          <video
            ref={remoteVideoRef}
            playsInline
            autoPlay
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute bottom-4 right-4 w-32 aspect-video sm:w-44 lg:w-56">
            <video
              ref={localVideoRef}
              muted
              playsInline
              autoPlay
              className="h-full w-full rounded-lg border border-white/40 bg-black/70 object-cover shadow-lg shadow-black/70"
            />
          </div>
        </div>
      </div>

      <video ref={remoteScreenRef} playsInline autoPlay className="hidden" />
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
          <div className="flex items-center justify-between">
            <span>Agents connected</span>
            <span className="text-white font-semibold">
              {liveAgentCount > 0 ? liveAgentCount : 'Waiting'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Agents can join via <code className="text-cyan-300">/agent</code>.
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-white">Show annotations</p>
              <p className="text-xs text-slate-500">
                Let the agent draw on the kiosk screen.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-white">
              <input
                type="checkbox"
                className="h-4 w-4 accent-cyan-500"
                checked={annotationsEnabled}
                onChange={(event) =>
                  setAnnotationsEnabled(event.target.checked)
                }
              />
              {annotationsEnabled ? 'On' : 'Off'}
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-sm text-slate-400 sm:flex-row">
        {showStartButton ? (
          <button
            onClick={startLiveAgentSession}
            disabled={callState === 'preparing'}
            className="flex-1 rounded-lg border border-slate-700 px-4 py-3 font-semibold text-white transition hover:border-slate-500 disabled:text-slate-500"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <PhoneCall size={18} />
              Request live agent
            </span>
          </button>
        ) : (
          <button
            onClick={endLiveAgentSession}
            className="flex-1 rounded-lg border border-slate-700 px-4 py-3 font-semibold text-white transition hover:border-slate-500"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <PhoneOff size={18} />
              End session
            </span>
          </button>
        )}
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
          {sessionId
            ? 'Agent sees current action details automatically.'
            : 'Start a session to share this screen with an agent.'}
        </div>
      </div>

      <AnnotationOverlay
        annotations={annotations}
        visible={
          annotationsEnabled && annotations.length > 0 && callState !== 'idle'
        }
      />
    </div>
  )
}

