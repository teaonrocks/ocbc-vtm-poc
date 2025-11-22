export type PeerRole = 'vtm' | 'agent'

export type DataChannelHandlers = {
  onOpen?: (channel: RTCDataChannel) => void
  onMessage?: (event: MessageEvent, channel: RTCDataChannel) => void
  onClose?: (channel: RTCDataChannel) => void
  onError?: (event: Event, channel: RTCDataChannel) => void
}

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
  try {
    const data = await fetch(`${resolveSignalingHttpUrl()}/sessions`, {
      method: 'POST',
    }).then(toJsonResponse)

    if (!data || typeof data !== 'object' || !('sessionId' in data)) {
      throw new Error('Invalid response from signaling server')
    }

    return {
      sessionId: data.sessionId as string,
      iceServers: formatIceServers(data.iceServers),
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Cannot connect to signaling server at ${resolveSignalingHttpUrl()}. Please ensure the server is running.`,
      )
    }
    throw error
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
  // Check if WebRTC is supported
  if (typeof RTCPeerConnection === 'undefined') {
    throw new Error(
      'WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.',
    )
  }

  // Validate and normalize ICE servers
  const normalizedIceServers = (() => {
    if (!iceServers || iceServers.length === 0) {
      console.warn('No ICE servers provided, using defaults')
      return defaultIceServers()
    }
    
    // Validate each ICE server entry
    const valid = iceServers.filter((server) => {
      if (!server || typeof server !== 'object') {
        console.warn('Invalid ICE server entry (not an object):', server)
        return false
      }
      if (!('urls' in server)) {
        console.warn('Invalid ICE server entry (missing urls):', server)
        return false
      }
      const urls = server.urls
      const isValid =
        typeof urls === 'string' ||
        (Array.isArray(urls) && urls.every((u) => typeof u === 'string'))
      if (!isValid) {
        console.warn('Invalid ICE server urls format:', urls)
      }
      return isValid
    })
    
    if (valid.length === 0) {
      console.warn('No valid ICE servers found, using defaults')
      return defaultIceServers()
    }
    
    return valid
  })()

  console.log('Creating RTCPeerConnection with normalized ICE servers:', normalizedIceServers)

  let peerConnection: RTCPeerConnection
  try {
    peerConnection = new RTCPeerConnection({
      iceServers: normalizedIceServers,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('RTCPeerConnection creation failed with provided ICE servers:', error)
    console.error('Error details:', {
      message: errorMessage,
      iceServers: normalizedIceServers,
      errorType: error?.constructor?.name,
    })
    
    // Try with minimal default ICE servers as fallback
    if (normalizedIceServers.length > 0) {
      console.warn('Retrying with minimal default ICE servers...')
      try {
        const minimalServers = defaultIceServers()
        peerConnection = new RTCPeerConnection({
          iceServers: minimalServers,
        })
        console.log('RTCPeerConnection created successfully with fallback ICE servers')
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        console.error('RTCPeerConnection creation failed even with fallback servers:', fallbackError)
        throw new Error(
          `Failed to create RTCPeerConnection: ${errorMessage}. Fallback also failed: ${fallbackMessage}. This may indicate a browser compatibility issue or WebRTC is not properly supported.`,
        )
      }
    } else {
      throw new Error(
        `Failed to create RTCPeerConnection: ${errorMessage}. This may indicate invalid ICE server configuration or browser compatibility issues.`,
      )
    }
  }

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
  
  // Helper to clean STUN URLs (remove query params that Safari doesn't like)
  const cleanStunUrl = (url: string): string => {
    if (url.startsWith('stun:') || url.startsWith('stuns:')) {
      // Remove query parameters from STUN URLs (Safari compatibility)
      return url.split('?')[0]
    }
    // Keep TURN URLs as-is (they may need query params for credentials)
    return url
  }
  
  const formatted = raw
    .map((entry) => {
      if (typeof entry === 'string') {
        return { urls: cleanStunUrl(entry) }
      }
      if (entry && typeof entry === 'object' && 'urls' in entry) {
        const urls = entry.urls
        if (typeof urls === 'string') {
          return { urls: cleanStunUrl(urls) }
        }
        if (Array.isArray(urls) && urls.every((u) => typeof u === 'string')) {
          return { urls: urls.map(cleanStunUrl) }
        }
      }
      return null
    })
    .filter((entry): entry is RTCIceServer => entry !== null)
  
  // If formatting resulted in empty array, use defaults
  if (formatted.length === 0) {
    console.warn('No valid ICE servers after formatting, using defaults')
    return defaultIceServers()
  }
  
  // Validate URLs are properly formatted
  const validated = formatted.filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
    return urls.every((url) => {
      if (typeof url !== 'string') return false
      // Check if it's a valid STUN/TURN URL format
      return (
        url.startsWith('stun:') ||
        url.startsWith('stuns:') ||
        url.startsWith('turn:') ||
        url.startsWith('turns:')
      )
    })
  })
  
  if (validated.length === 0) {
    console.warn('No valid STUN/TURN URLs found, using defaults')
    return defaultIceServers()
  }
  
  return validated
}

function wireChannelEvents(
  channel: RTCDataChannel,
  handlers: DataChannelHandlers,
) {
  if (handlers.onOpen) {
    channel.addEventListener('open', () => handlers.onOpen?.(channel), {
      once: true,
    })
  }
  if (handlers.onMessage) {
    channel.addEventListener('message', (event) =>
      handlers.onMessage?.(event, channel),
    )
  }
  if (handlers.onClose) {
    channel.addEventListener('close', () => handlers.onClose?.(channel))
  }
  if (handlers.onError) {
    channel.addEventListener('error', (event) =>
      handlers.onError?.(event, channel),
    )
  }
}

export function createDataChannel(
  peerConnection: RTCPeerConnection,
  label: string,
  handlers?: DataChannelHandlers,
  options?: RTCDataChannelInit,
) {
  const channel = peerConnection.createDataChannel(label, options)
  if (handlers) {
    wireChannelEvents(channel, handlers)
  }
  return channel
}

export function registerDataChannelHandler(
  peerConnection: RTCPeerConnection,
  handler: (event: RTCDataChannelEvent) => void,
) {
  peerConnection.ondatachannel = handler
  return () => {
    if (peerConnection.ondatachannel === handler) {
      peerConnection.ondatachannel = null
    }
  }
}

export function attachHandlersToChannel(
  channel: RTCDataChannel,
  handlers: DataChannelHandlers,
) {
  wireChannelEvents(channel, handlers)
  return channel
}

