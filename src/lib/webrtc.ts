export type PeerRole = 'vtm' | 'agent'

export type SignalingMessage =
  | {
      type: 'offer' | 'answer'
      payload: RTCSessionDescriptionInit
      senderRole?: PeerRole
    }
  | {
      type: 'ice'
      payload: RTCIceCandidateInit
      senderRole?: PeerRole
    }
  | {
      type: 'hangup' | 'peer-ready' | 'peer-update' | 'heartbeat'
      payload?: Record<string, unknown>
      senderRole?: PeerRole
    }
  | {
      type: 'error'
      payload?: { message?: string }
      senderRole?: PeerRole
    }

export type SessionSummary = {
  id: string
  createdAt: number
  participantCount: number
}

const defaultHttpUrl =
  import.meta.env.VITE_SIGNALING_HTTP_URL ?? 'http://localhost:4100'

const defaultWsUrl =
  import.meta.env.VITE_SIGNALING_WS_URL ??
  defaultHttpUrl.replace('http', 'ws').concat('/ws')

export function resolveSignalingHttpUrl() {
  return defaultHttpUrl.replace(/\/$/, '')
}

export function resolveSignalingWsUrl() {
  return defaultWsUrl
}

function toJsonResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Signaling server error: ${response.statusText}`)
  }
  return response.json()
}

export async function createSignalingSession() {
  const data = await fetch(`${resolveSignalingHttpUrl()}/sessions`, {
    method: 'POST',
  }).then(toJsonResponse)

  return {
    sessionId: data.sessionId as string,
    iceServers: formatIceServers(data.iceServers),
  }
}

export async function listSignalingSessions() {
  const data = await fetch(`${resolveSignalingHttpUrl()}/sessions`).then(
    toJsonResponse,
  )
  return data as SessionSummary[]
}

export function connectSignalingSocket({
  sessionId,
  role,
  onMessage,
  onClose,
  onOpen,
}: {
  sessionId: string
  role: PeerRole
  onMessage: (message: SignalingMessage) => void
  onClose?: (event: CloseEvent) => void
  onOpen?: () => void
}) {
  const wsUrl = new URL(resolveSignalingWsUrl())
  wsUrl.searchParams.set('sessionId', sessionId)
  wsUrl.searchParams.set('role', role)

  const socket = new WebSocket(wsUrl)
  socket.onopen = () => onOpen?.()
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as SignalingMessage
      onMessage(message)
    } catch (err) {
      console.error('Failed to parse signaling message', err)
    }
  }
  socket.onclose = (event) => onClose?.(event)

  return socket
}

export function buildPeerConnection({
  iceServers,
  onIceCandidate,
  onTrack,
  onConnectionStateChange,
}: {
  iceServers?: RTCIceServer[]
  onIceCandidate?: (candidate: RTCIceCandidate) => void
  onTrack?: (event: RTCTrackEvent) => void
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
}) {
  const peerConnection = new RTCPeerConnection({
    iceServers: iceServers?.length ? iceServers : defaultIceServers(),
  })

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate?.(event.candidate)
    }
  }

  peerConnection.ontrack = (event) => {
    onTrack?.(event)
  }

  peerConnection.onconnectionstatechange = () => {
    onConnectionStateChange?.(peerConnection.connectionState)
  }

  return peerConnection
}

export async function createCameraStream(
  constraints?: MediaStreamConstraints,
) {
  return navigator.mediaDevices.getUserMedia(
    constraints ?? {
      audio: true,
      video: {
        width: 1280,
        height: 720,
        facingMode: 'user',
      },
    },
  )
}

export async function createScreenStream(
  constraints?: DisplayMediaStreamOptions,
) {
  return navigator.mediaDevices.getDisplayMedia(
    constraints ?? {
      video: {
        displaySurface: 'monitor',
      },
      audio: false,
    },
  )
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function addStreamToPeer(
  peerConnection: RTCPeerConnection,
  stream: MediaStream,
) {
  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream)
  })
}

export function categorizeTrack(track: MediaStreamTrack | null | undefined) {
  if (!track) {
    return 'camera'
  }
  if (track.kind === 'audio') {
    return 'audio'
  }
  const label = track.label.toLowerCase()
  if (label.includes('screen') || label.includes('display')) {
    return 'screen'
  }
  return 'camera'
}

function defaultIceServers(): RTCIceServer[] {
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

function formatIceServers(raw: unknown): RTCIceServer[] {
  if (!Array.isArray(raw)) {
    return defaultIceServers()
  }
  return raw
    .map((entry) => {
      if (typeof entry === 'string') {
        return { urls: entry }
      }
      if (
        entry &&
        typeof entry === 'object' &&
        'urls' in entry &&
        typeof entry.urls === 'string'
      ) {
        return { urls: entry.urls as string }
      }
      return null
    })
    .filter(Boolean) as RTCIceServer[]
}

