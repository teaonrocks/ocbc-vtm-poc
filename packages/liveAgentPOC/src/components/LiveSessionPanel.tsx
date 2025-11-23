import { useEffect, useRef } from 'react'
import { MonitorUp, PhoneOff, Video } from 'lucide-react'
import type { AgentCallState } from '../hooks/useAgentSession'

type LiveSessionPanelProps = {
  callState: AgentCallState
  callError?: string | null
  sessionId: string | null
  localStream: MediaStream | null
  remoteCameraStream: MediaStream | null
  remoteScreenStream: MediaStream | null
  remoteAudioStream: MediaStream | null
  onHangUp: () => void
}

const statusCopy: Record<AgentCallState, string> = {
  idle: 'Idle',
  answering: 'Joining',
  connected: 'Connected',
  error: 'Error',
}

const statusColor: Record<AgentCallState, string> = {
  idle: 'bg-gray-100 text-gray-700',
  answering: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  connected: 'bg-green-100 text-green-800 border border-green-200',
  error: 'bg-red-100 text-red-800 border border-red-200',
}

export function LiveSessionPanel({
  callState,
  callError,
  sessionId,
  localStream,
  remoteCameraStream,
  remoteScreenStream,
  remoteAudioStream,
  onHangUp,
}: LiveSessionPanelProps) {
  const localRef = useRef<HTMLVideoElement | null>(null)
  const remoteCameraRef = useRef<HTMLVideoElement | null>(null)
  const remoteScreenRef = useRef<HTMLVideoElement | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (localRef.current) {
      localRef.current.srcObject = localStream ?? null
    }
  }, [localStream])

  useEffect(() => {
    if (remoteCameraRef.current) {
      remoteCameraRef.current.srcObject = remoteCameraStream ?? null
    }
  }, [remoteCameraStream])

  useEffect(() => {
    if (remoteScreenRef.current) {
      remoteScreenRef.current.srcObject = remoteScreenStream ?? null
    }
  }, [remoteScreenStream])

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteAudioStream ?? null
    }
  }, [remoteAudioStream])

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Video size={20} className="text-[#E1251B]" />
            Live Session Monitor
          </h2>
          <p className="text-sm text-gray-500">
            Engage with the kiosk’s camera, screen share, and audio feeds.
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusColor[callState]}`}
        >
          <span>{statusCopy[callState]}</span>
          {sessionId && (
            <code className="text-xs font-mono text-gray-700 bg-white/70 px-2 py-0.5 rounded">
              {sessionId}
            </code>
          )}
        </div>
      </div>

      {callError && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {callError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
            <MonitorUp size={16} />
            Local Preview
          </div>
          <video
            ref={localRef}
            muted
            playsInline
            autoPlay
            className="w-full aspect-video rounded-lg bg-gray-900 border border-gray-200 object-cover"
          />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
            <MonitorUp size={16} />
            Kiosk Camera
          </div>
          <video
            ref={remoteCameraRef}
            playsInline
            autoPlay
            className="w-full aspect-video rounded-lg bg-gray-900 border border-gray-200 object-contain"
          />
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
          <MonitorUp size={16} />
          Shared Screen
        </div>
        <video
          ref={remoteScreenRef}
          playsInline
          autoPlay
          className="w-full aspect-video rounded-lg bg-gray-900 border border-gray-200 object-contain"
        />
      </div>

      {callState !== 'idle' && (
        <button
          onClick={onHangUp}
          className="inline-flex items-center gap-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 transition-colors"
        >
          <PhoneOff size={16} />
          End Session
        </button>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
    </div>
  )
}

