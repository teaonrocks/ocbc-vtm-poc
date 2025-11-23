import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addStreamToPeer,
  buildPeerConnection,
  categorizeTrack,
  connectSignalingSocket,
  createCameraStream,
  stopStream,
  type SignalingMessage,
} from '@ocbc/webrtc-client'

export type AgentCallState = 'idle' | 'answering' | 'connected' | 'error'

export function useAgentSession() {
  const [callState, setCallState] = useState<AgentCallState>('idle')
  const [callError, setCallError] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteCameraStream, setRemoteCameraStream] =
    useState<MediaStream | null>(null)
  const [remoteScreenStream, setRemoteScreenStream] =
    useState<MediaStream | null>(null)
  const [remoteAudioStream, setRemoteAudioStream] =
    useState<MediaStream | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pendingSignalsRef = useRef<Array<SignalingMessage>>([])

  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteCameraStreamRef = useRef<MediaStream | null>(null)
  const remoteScreenStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioStreamRef = useRef<MediaStream | null>(null)

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

      pendingSignalsRef.current = []

      stopStream(localStreamRef.current)
      stopStream(remoteCameraStreamRef.current)
      stopStream(remoteScreenStreamRef.current)
      stopStream(remoteAudioStreamRef.current)

      localStreamRef.current = null
      remoteCameraStreamRef.current = null
      remoteScreenStreamRef.current = null
      remoteAudioStreamRef.current = null

      setLocalStream(null)
      setRemoteCameraStream(null)
      setRemoteScreenStream(null)
      setRemoteAudioStream(null)

      setCallState(nextState)
      setActiveSessionId((prev) => (nextState === 'idle' ? null : prev))

      if (reason) {
        setCallError(reason)
      } else if (nextState === 'idle') {
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
        setRemoteAudioStream(remoteAudioStreamRef.current)
      }
      return
    }

    if (trackType === 'screen') {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      remoteScreenStreamRef.current = stream
      setRemoteScreenStream(stream)
      return
    }

    const stream = event.streams[0] ?? new MediaStream([event.track])
    remoteCameraStreamRef.current = stream
    setRemoteCameraStream(stream)
  }, [])

  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      if (message.type === 'peer-update' || message.type === 'heartbeat') {
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
      } catch (error) {
        cleanupCall(
          error instanceof Error
            ? error.message
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
        throw new Error('Missing session ID')
      }
      if (callState === 'connected' || callState === 'answering') {
        throw new Error('Already handling a session')
      }

      setCallState('answering')
      setActiveSessionId(sessionId)
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

        const local = await createCameraStream()
        localStreamRef.current = local
        setLocalStream(local)
        addStreamToPeer(peer, local)

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
      } catch (error) {
        cleanupCall(
          error instanceof Error ? error.message : 'Failed to join session',
          'error',
        )
        throw error
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

  return {
    callState,
    callError,
    activeSessionId,
    localStream,
    remoteCameraStream,
    remoteScreenStream,
    remoteAudioStream,
    joinSession,
    hangUp,
  }
}

