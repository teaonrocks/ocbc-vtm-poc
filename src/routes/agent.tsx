import { createFileRoute } from '@tanstack/react-router'
import {
  Clock,
  MonitorUp,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Video,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addStreamToPeer,
  buildPeerConnection,
  categorizeTrack,
  connectSignalingSocket,
  createCameraStream,
  listSignalingSessions,
  stopStream,
  type SessionSummary,
  type SignalingMessage,
} from '../lib/webrtc'

type AgentCallState = 'idle' | 'answering' | 'connected' | 'error'

export const Route = createFileRoute('/agent')({
  component: AgentConsole,
})

function AgentConsole() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pollError, setPollError] = useState<string | null>(null)
  const [callState, setCallState] = useState<AgentCallState>('idle')
  const [callError, setCallError] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [manualSessionId, setManualSessionId] = useState('')
  const [remoteFeeds, setRemoteFeeds] = useState<{
    camera: MediaStream | null
    screen: MediaStream | null
  }>({ camera: null, screen: null })
  const [remoteAudioVersion, setRemoteAudioVersion] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pendingSignalsRef = useRef<SignalingMessage[]>([])

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteScreenRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteCameraStreamRef = useRef<MediaStream | null>(null)
  const remoteScreenStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current ?? null
    }
  }, [callState])

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

  const refreshSessions = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const data = await listSignalingSessions()
      setSessions(data)
      setPollError(null)
    } catch (err) {
      setPollError(
        err instanceof Error ? err.message : 'Failed to load sessions',
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refreshSessions()
    const interval = setInterval(() => {
      void refreshSessions()
    }, 5000)
    return () => clearInterval(interval)
  }, [refreshSessions])

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

  const cleanupCall = useCallback(
    (
      reason?: string,
      nextState: AgentCallState = 'idle',
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

      stopStream(localStreamRef.current)
      stopStream(remoteCameraStreamRef.current)
      stopStream(remoteScreenStreamRef.current)
      stopStream(remoteAudioStreamRef.current)

      localStreamRef.current = null
      remoteCameraStreamRef.current = null
      remoteScreenStreamRef.current = null
      remoteAudioStreamRef.current = null

      setRemoteFeeds({ camera: null, screen: null })
      setRemoteAudioVersion((prev) => prev + 1)
      setCallState(nextState)
      pendingSignalsRef.current = []
      if (nextState === 'idle') {
        setSelectedSessionId(null)
      }

      if (reason) {
        setCallError(reason)
      } else {
        setCallError(null)
      }
    },
    [],
  )

  useEffect(() => {
    return () => {
      cleanupCall()
    }
  }, [cleanupCall])

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

  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      if (message.type === 'peer-update') {
        return
      }
      if (message.type === 'heartbeat') {
        return
      }
      if (message.type === 'error') {
        cleanupCall(
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
        if (message.type === 'offer' && message.payload) {
          await peer.setRemoteDescription(message.payload)
          const answer = await peer.createAnswer()
          await peer.setLocalDescription(answer)
          sendSignal({ type: 'answer', payload: answer })
          setCallState('connected')
        } else if (message.type === 'ice' && message.payload) {
          await peer.addIceCandidate(message.payload)
        } else if (message.type === 'hangup') {
          cleanupCall('Kiosk disconnected', 'idle', false)
        }
      } catch (err) {
        cleanupCall(
          err instanceof Error
            ? err.message
            : 'Failed to process signaling event',
          'error',
          false,
        )
      }
    },
    [cleanupCall, sendSignal],
  )

  const joinSession = useCallback(
    async (sessionId: string) => {
      if (!sessionId) {
        return
      }
      if (callState === 'connected' || callState === 'answering') {
        return
      }

      setSelectedSessionId(sessionId)
      setCallState('answering')
      setCallError(null)

      try {
        const peer = buildPeerConnection({
          onIceCandidate: (candidate) => {
            if (candidate) {
              const payload = candidate.toJSON()
              sendSignal({ type: 'ice', payload })
            }
          },
          onTrack: handleRemoteTrack,
          onConnectionStateChange: (state) => {
            if (state === 'failed') {
              cleanupCall('Peer connection failed', 'error')
            }
          },
        })
        pcRef.current = peer

        const localStream = await createCameraStream()
        localStreamRef.current = localStream
        addStreamToPeer(peer, localStream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream
        }

        const socket = connectSignalingSocket({
          sessionId,
          role: 'agent',
          onMessage: handleSignalingMessage,
          onClose: () => {
            cleanupCall('Signaling channel closed', 'error', false)
          },
          onOpen: () => {
            flushPendingSignals()
          },
        })
        wsRef.current = socket
      } catch (err) {
        cleanupCall(
          err instanceof Error ? err.message : 'Failed to join session',
          'error',
        )
      }
    },
    [
      callState,
      cleanupCall,
      flushPendingSignals,
      handleRemoteTrack,
      handleSignalingMessage,
      sendSignal,
    ],
  )

  const hangUp = useCallback(() => {
    if (callState === 'idle') {
      return
    }
    sendSignal({ type: 'hangup' })
    cleanupCall(undefined, 'idle')
  }, [callState, cleanupCall, sendSignal])

  const filteredSessions = useMemo(
    () => sessions.filter((session) => session.participantCount > 0),
    [sessions],
  )

  const statusCopy: Record<AgentCallState, string> = {
    idle: 'Idle',
    answering: 'Answering',
    connected: 'Connected',
    error: 'Error',
  }

  const statusColor: Record<AgentCallState, string> = {
    idle: 'bg-gray-700 text-gray-100',
    answering: 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/40',
    connected: 'bg-green-500/20 text-green-200 border border-green-500/40',
    error: 'bg-red-500/20 text-red-200 border border-red-500/40',
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white py-10 px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agent Console</h1>
            <p className="text-gray-400">
              Join kiosk escalations with live video, audio, and screen share.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor[callState]}`}
            >
              {statusCopy[callState]}
            </span>
            <button
              onClick={() => void refreshSessions()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-gray-200 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? 'animate-spin' : undefined}
              />
              Refresh
            </button>
            {callState !== 'idle' && (
              <button
                onClick={hangUp}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
              >
                <PhoneOff size={16} />
                Hang Up
              </button>
            )}
          </div>
        </div>

        {callError && (
          <div className="p-4 rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-200">
            {callError}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_2fr]">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock size={18} />
                Waiting Sessions
              </h2>
              <span className="text-xs text-gray-400">
                {filteredSessions.length} active
              </span>
            </div>

            {pollError && (
              <div className="p-3 text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                {pollError}
              </div>
            )}

            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {filteredSessions.length === 0 && (
                <div className="text-sm text-gray-500">
                  No kiosks are requesting assistance right now. Stay ready!
                </div>
              )}
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={`rounded-lg border px-3 py-3 ${selectedSessionId === session.id ? 'border-cyan-500/80 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/60'}`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-mono text-cyan-300">{session.id}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-gray-400 text-xs">
                        Peers: {session.participantCount}
                      </span>
                      <button
                        onClick={() => joinSession(session.id)}
                        disabled={callState !== 'idle'}
                        className="inline-flex items-center gap-1 rounded-md bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed px-3 py-1 text-xs font-semibold text-white transition-colors"
                      >
                        <PhoneCall size={14} />
                        Answer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-500 border-t border-slate-800 pt-3">
              Need to join manually? Enter the session code below.
            </div>
            <div className="flex gap-2">
              <input
                value={manualSessionId}
                onChange={(event) => setManualSessionId(event.target.value)}
                placeholder="SESSION ID"
                className="flex-1 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring focus:ring-cyan-500/40"
              />
              <button
                onClick={() => joinSession(manualSessionId.trim())}
                disabled={!manualSessionId}
                className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-800 disabled:text-gray-500"
              >
                Join
              </button>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Video size={18} />
                Call Desk
              </h2>
              <span className="text-xs text-gray-400">
                {selectedSessionId ? `Session ${selectedSessionId}` : 'No session'}
              </span>
            </div>

            <div className="grid gap-4">
              <div>
                <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <MonitorUp size={16} />
                  Local Preview
                </div>
                <video
                  ref={localVideoRef}
                  muted
                  playsInline
                  autoPlay
                  className="w-full aspect-video rounded-lg bg-black border border-slate-800 object-cover"
                />
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <MonitorUp size={16} />
                  Kiosk Camera
                </div>
                <video
                  ref={remoteVideoRef}
                  playsInline
                  autoPlay
                  className="w-full aspect-video rounded-lg bg-black border border-slate-800 object-contain"
                />
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  <MonitorUp size={16} />
                  Shared Screen
                </div>
                <video
                  ref={remoteScreenRef}
                  playsInline
                  autoPlay
                  className="w-full aspect-video rounded-lg bg-black border border-slate-800 object-contain"
                />
              </div>
            </div>

            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
          </div>
        </div>
      </div>
    </div>
  )
}

