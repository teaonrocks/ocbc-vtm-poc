import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Globe,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  PhoneCall,
  PhoneOff,
} from 'lucide-react'
import { useBankStore, type BankingAction } from '../data/bank-store'
import { useLocalAI } from '../hooks/useLocalAI'
import { analyzeIntent } from '../functions/ai-intent'
import { AudioVisualizer } from '../components/Dashboard/AudioVisualizer'
import { ActionCards } from '../components/Dashboard/ActionCards'
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
} from '@ocbc/webrtc-client'
import type { SignalingMessage } from '@ocbc/webrtc-client'
import { createLiveAgentTicket } from '../lib/live-agent'
import { AnnotationOverlay } from '../components/LiveAgent/AnnotationOverlay'
import type { RenderableAnnotation } from '../components/LiveAgent/AnnotationOverlay'
import {
  ANNOTATION_CHANNEL_LABEL,
  DEFAULT_ANNOTATION_TTL,
  type AnnotationMessage,
} from '../types/annotations'

type CallState = 'idle' | 'preparing' | 'connecting' | 'connected' | 'error'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const {
    currentAction,
    language,
    isRecording,
    isProcessing,
    setCurrentAction,
    setLanguage,
    setIsRecording,
    setIsProcessing,
    balance,
    transactions,
  } = useBankStore()

  const { transcribeAudio, isReady, error: aiError } = useLocalAI()
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream

      const chunks: Array<Blob> = []
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop())
          audioStreamRef.current = null
        }

        if (chunks.length === 0) {
          setError('No audio recorded')
          setIsRecording(false)
          return
        }

        setIsProcessing(true)
        try {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' })
          const { text, language: detectedLang } =
            await transcribeAudio(audioBlob)

          // Update language if detected
          if (detectedLang && detectedLang !== language) {
            setLanguage(detectedLang)
          }

          // Send to server function for intent analysis
          const intentResult = await analyzeIntent({ data: { text } })

          setCurrentAction({
            intent: intentResult.intent,
            amount: intentResult.amount,
            recipient: intentResult.recipient,
            duration: intentResult.duration,
            timestamp: Date.now(),
          })
        } catch (err) {
          console.error('Processing error:', err)
          setError(
            err instanceof Error ? err.message : 'Failed to process audio',
          )
        } finally {
          setIsProcessing(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Recording error:', err)
      setError('Failed to access microphone')
      setIsRecording(false)
    }
  }, [
    transcribeAudio,
    language,
    setLanguage,
    setIsRecording,
    setIsProcessing,
    setCurrentAction,
  ])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording, setIsRecording])

  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
            <span className="bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Smart Banking Kiosk
            </span>
          </h1>
          <p className="text-gray-400 text-lg">
            Voice-powered banking with local AI
          </p>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${isReady ? 'bg-green-400' : 'bg-red-400'}`}
              />
              <span className="text-gray-400 text-sm">
                AI {isReady ? 'Ready' : 'Loading...'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="text-gray-400" size={16} />
              <span className="text-gray-400 text-sm">
                Language: {language.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="text-white font-semibold text-xl">
            Balance: ${balance.toLocaleString()}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Audio Input */}
          <div className="lg:col-span-2 space-y-6">
            {/* Audio Visualizer */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">
                Voice Input
              </h2>
              <AudioVisualizer
                audioStream={audioStreamRef.current || null}
                isRecording={isRecording}
              />
            </div>

            {/* Recording Controls */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              {aiError && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                  AI Error: {aiError}
                </div>
              )}

              {isProcessing ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="text-cyan-400 animate-spin" size={48} />
                  <p className="text-gray-400">Processing your request...</p>
                </div>
              ) : (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={!isReady}
                  className={`mx-auto flex items-center gap-3 px-8 py-4 rounded-full text-white font-semibold text-lg transition-all ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <MicOff size={24} />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic size={24} />
                      Start Recording
                    </>
                  )}
                </button>
              )}

              <p className="text-gray-500 text-sm mt-4">
                {isRecording
                  ? 'Speak your banking request now...'
                  : 'Press the button and speak your banking request'}
              </p>
            </div>

            {/* Action Display */}
            {currentAction && (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <ActionCards action={currentAction} />
              </div>
            )}
          </div>

          {/* Right Column - Account Info */}
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">
                Account Summary
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="text-gray-400 text-sm">Available Balance</div>
                  <div className="text-white text-2xl font-bold">
                    ${balance.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">
                    Recent Transactions
                  </div>
                  <div className="text-white text-lg">
                    {transactions.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">
                Recent Transactions
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center p-2 bg-slate-900/50 rounded"
                  >
                    <div>
                      <div className="text-white text-sm">{tx.description}</div>
                      <div className="text-gray-500 text-xs">
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    <div
                      className={`font-semibold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}$
                      {tx.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <LiveAgentAssistPanel
              currentAction={currentAction}
              language={language}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-3">
            Voice Commands
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-cyan-400 font-semibold mb-1">Remittance</div>
              <div className="text-gray-400">"Send $1000 to John Doe"</div>
            </div>
            <div>
              <div className="text-blue-400 font-semibold mb-1">Loan</div>
              <div className="text-gray-400">
                "Apply for $5000 loan for 12 months"
              </div>
            </div>
            <div>
              <div className="text-green-400 font-semibold mb-1">Card App</div>
              <div className="text-gray-400">"Apply for a new card"</div>
            </div>
            <div>
              <div className="text-purple-400 font-semibold mb-1">
                Update Book
              </div>
              <div className="text-gray-400">"Update my bank book"</div>
            </div>
            <div>
              <div className="text-red-400 font-semibold mb-1">
                Card Replace
              </div>
              <div className="text-gray-400">"Replace my card"</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LiveAgentAssistPanel({
  currentAction,
  language,
}: {
  currentAction: BankingAction | null
  language: string
}) {
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
            console.log(
              '[live-agent] Agent joined; replaying offer to ensure negotiation starts.',
            )
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
      console.log('Signaling session created:', { sessionId: id, iceServers })
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
        console.log('Creating RTCPeerConnection with ICE servers:', iceServers)
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
        console.log('RTCPeerConnection created successfully')
      } catch (peerError) {
        console.error('RTCPeerConnection creation error:', peerError)
        const errorMessage =
          peerError instanceof Error
            ? peerError.message
            : 'Unknown error'
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

      // Screen sharing is optional - proceed with camera only if screen share fails
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
          console.log('Screen sharing enabled')
        }
      } catch (err) {
        console.warn(
          'Screen sharing not available or denied:',
          err instanceof Error ? err.message : err,
        )
        // Continue without screen sharing - camera feed is sufficient
        setCallError(
          'Screen sharing is not available. The live agent will still be able to see your camera feed.',
        )
        // Clear the error after a few seconds so it doesn't block the UI
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
    idle: 'bg-gray-700 text-gray-100',
    preparing: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    connecting: 'bg-blue-500/20 text-blue-200 border border-blue-500/40',
    connected: 'bg-green-500/20 text-green-200 border border-green-500/40',
    error: 'bg-red-500/20 text-red-200 border border-red-500/40',
  }

  const liveAgentCount = Math.max(participantCount - 1, 0)
  const showStartButton =
    callState === 'idle' || callState === 'error' || callState === 'preparing'

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            Live Agent Assist
          </h2>
          <p className="text-sm text-gray-400">
            Escalate to a human when customers need a person.
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor[callState]}`}
        >
          {statusCopy[callState]}
        </span>
      </div>

      {sessionId && (
        <div className="text-sm text-gray-400">
          Session ID:{' '}
          <span className="text-cyan-400 font-mono">{sessionId}</span>
        </div>
      )}

      {callError && (
        <div className="p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg">
          {callError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <div className="flex items-center text-sm text-gray-400 gap-2 mb-2">
            <MonitorUp size={16} />
            <span>Local Preview</span>
          </div>
          <video
            ref={localVideoRef}
            muted
            playsInline
            autoPlay
            className="w-full aspect-video rounded-lg bg-black border border-slate-700 object-cover"
          />
        </div>

        <div>
          <div className="flex items-center text-sm text-gray-400 gap-2 mb-2">
            <MonitorUp size={16} />
            <span>Remote Agent Video</span>
          </div>
          <video
            ref={remoteVideoRef}
            playsInline
            autoPlay
            className="w-full aspect-video rounded-lg bg-black border border-slate-700 object-contain"
          />
        </div>

        <div>
          <div className="flex items-center text-sm text-gray-400 gap-2 mb-2">
            <MonitorUp size={16} />
            <span>Shared Screen (Agent View)</span>
          </div>
          <video
            ref={remoteScreenRef}
            playsInline
            autoPlay
            className="w-full aspect-video rounded-lg bg-black border border-slate-700 object-contain"
          />
        </div>
      </div>

      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="bg-slate-900/40 rounded-lg p-3 text-sm text-gray-300">
        <div className="flex items-center justify-between mb-2">
          <span>Agents connected</span>
          <span className="text-white font-semibold">
            {liveAgentCount > 0 ? liveAgentCount : 'Waiting'}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Agents can join by opening{' '}
          <code className="text-cyan-400">/agent</code> on the same network.
        </p>
      </div>

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-sm text-gray-300">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Show agent annotations</p>
            <p className="text-xs text-gray-500">
              Overlays sent from the live agent will appear on the kiosk UI.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-white">
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-500"
              checked={annotationsEnabled}
              onChange={(event) => setAnnotationsEnabled(event.target.checked)}
            />
            {annotationsEnabled ? 'On' : 'Off'}
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {showStartButton ? (
          <button
            onClick={startLiveAgentSession}
            disabled={callState === 'preparing'}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 font-semibold text-white transition-colors"
          >
            <PhoneCall size={18} />
            Request Live Agent
          </button>
        ) : (
          <button
            onClick={endLiveAgentSession}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 hover:bg-red-600 px-4 py-3 font-semibold text-white transition-colors"
          >
            <PhoneOff size={18} />
            End Session
          </button>
        )}
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
