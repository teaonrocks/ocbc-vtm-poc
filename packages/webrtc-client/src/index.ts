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

const fallbackHttpUrl = 'https://localhost:4100'

const WEBRTC_LOG_PREFIX = '[webrtc-client]'

function debugLog(...args: unknown[]) {
  if (typeof console === 'undefined') {
    return
  }
  if (typeof console.debug === 'function') {
    console.debug(WEBRTC_LOG_PREFIX, ...args)
    return
  }
  console.log(WEBRTC_LOG_PREFIX, ...args)
}

function errorLog(...args: unknown[]) {
  if (typeof console === 'undefined') {
    return
  }
  if (typeof console.error === 'function') {
    console.error(WEBRTC_LOG_PREFIX, ...args)
    return
  }
  console.log(WEBRTC_LOG_PREFIX, ...args)
}

function summarizeIceCandidate(candidate: RTCIceCandidate | null) {
  if (!candidate) {
    return '⛔️ No candidate (end of gathering)'
  }
  const {
    candidate: raw,
    sdpMid,
    sdpMLineIndex,
    foundation,
    component,
    priority,
    protocol,
    type,
    relatedAddress,
    relatedPort,
    usernameFragment,
  } = candidate

  return {
    type: type ?? 'unknown',
    protocol,
    foundation,
    component,
    priority,
    sdpMid,
    sdpMLineIndex,
    relatedAddress,
    relatedPort,
    usernameFragment,
    raw,
  }
}

function normalizeBaseUrl(raw: string) {
  return raw.replace(/\/$/, '')
}

function httpToWs(url: string) {
  if (url.startsWith('https://')) {
    return url.replace(/^https:\/\//, 'wss://')
  }
  if (url.startsWith('http://')) {
    return url.replace(/^http:\/\//, 'ws://')
  }
  return url
}

const defaultHttpUrl = normalizeBaseUrl(
  import.meta.env.VITE_SIGNALING_HTTP_URL ?? fallbackHttpUrl,
)

const defaultWsUrl =
  import.meta.env.VITE_SIGNALING_WS_URL ?? `${httpToWs(defaultHttpUrl)}/ws`

type MaybeEnv = {
  env?: Record<string, string | boolean | undefined>
}

function parseBooleanEnv(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
  }
  return false
}

const disableStunEnv =
  (import.meta as MaybeEnv)?.env?.VITE_DISABLE_STUN ??
  (import.meta as MaybeEnv)?.env?.VITE_DISABLE_ICE

const stunDisabled = parseBooleanEnv(disableStunEnv)

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
    if (stunDisabled) {
      debugLog(
        'STUN discovery disabled via VITE_DISABLE_STUN; forcing host-only ICE candidates.',
      )
      return []
    }
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

  debugLog(
    'Creating RTCPeerConnection with normalized ICE servers:',
    normalizedIceServers,
  )

  let peerConnection: RTCPeerConnection
  try {
    peerConnection = new RTCPeerConnection({
      iceServers: normalizedIceServers,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error(
      'RTCPeerConnection creation failed with provided ICE servers:',
      error,
    )
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
        debugLog(
          'RTCPeerConnection created successfully with fallback ICE servers',
        )
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : 'Unknown error'
        errorLog(
          'RTCPeerConnection creation failed even with fallback servers:',
          fallbackError,
        )
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
    debugLog(
      'ICE candidate event',
      summarizeIceCandidate(event.candidate ?? null),
    )
    if (event.candidate) {
      onIceCandidate?.(event.candidate)
    } else {
      debugLog('ICE candidate gathering complete')
    }
  }

  peerConnection.onicecandidateerror = (event) => {
    errorLog('ICE candidate error', {
      errorCode: event.errorCode,
      errorText: event.errorText,
      url: event.url,
    })
  }

  peerConnection.oniceconnectionstatechange = () => {
    debugLog('ICE connection state changed', peerConnection.iceConnectionState)
  }

  peerConnection.onicegatheringstatechange = () => {
    debugLog('ICE gathering state changed', peerConnection.iceGatheringState)
  }

  peerConnection.onsignalingstatechange = () => {
    debugLog('Signaling state changed', peerConnection.signalingState)
  }

  peerConnection.onnegotiationneeded = () => {
    debugLog('Negotiation needed event fired')
  }

  peerConnection.ontrack = (event) => {
    debugLog('Remote track received', {
      id: event.track.id,
      kind: event.track.kind,
      label: event.track.label,
      streamIds: event.streams.map((stream) => stream.id),
    })
    onTrack?.(event)
  }

  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState
    debugLog('Peer connection state changed', state)
    onConnectionStateChange?.(state)
  }

  peerConnection.ondatachannel = (event) => {
    debugLog('Remote data channel opened', {
      label: event.channel.label,
      id: event.channel.id,
      negotiated: event.channel.negotiated,
    })
  }

  return peerConnection
}

export async function createCameraStream(constraints?: MediaStreamConstraints) {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    throw new Error(
      'Camera APIs are unavailable in this environment. Please run inside a supported browser and allow camera access.',
    )
  }

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
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getDisplayMedia !== 'function'
  ) {
    throw new Error(
      'Screen sharing APIs are unavailable in this environment. Try launching the kiosk in a browser that supports screen capture.',
    )
  }

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
  if (!stream) {
    return
  }
  debugLog('Stopping media stream', {
    id: stream.id,
    tracks: stream.getTracks().map((track) => ({
      id: track.id,
      kind: track.kind,
      label: track.label,
      readyState: track.readyState,
    })),
  })
  stream.getTracks().forEach((track) => track.stop())
}

export function addStreamToPeer(
  peerConnection: RTCPeerConnection,
  stream: MediaStream,
) {
  debugLog('Adding local stream to peer connection', {
    connectionState: peerConnection.connectionState,
    streamId: stream.id,
    tracks: stream.getTracks().map((track) => ({
      id: track.id,
      kind: track.kind,
      label: track.label,
    })),
  })
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

  const hint = track.contentHint?.toLowerCase()
  if (hint && (hint.includes('screen') || hint.includes('display'))) {
    return 'screen'
  }

  const displaySurface = (() => {
    try {
      const settings = track.getSettings?.()
      return typeof settings?.displaySurface === 'string'
        ? settings.displaySurface.toLowerCase()
        : null
    } catch {
      return null
    }
  })()
  if (
    displaySurface &&
    (displaySurface.includes('monitor') ||
      displaySurface.includes('window') ||
      displaySurface.includes('application') ||
      displaySurface.includes('browser'))
  ) {
    return 'screen'
  }

  const label = track.label.toLowerCase()
  if (label.includes('screen') || label.includes('display')) {
    return 'screen'
  }
  return 'camera'
}

function defaultIceServers(): RTCIceServer[] {
  if (stunDisabled) {
    debugLog(
      'VITE_DISABLE_STUN is enabled; returning an empty ICE server list (LAN-only mode).',
    )
    return []
  }
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

function formatIceServers(raw: unknown): RTCIceServer[] {
  if (!Array.isArray(raw)) {
    return defaultIceServers()
  }

  type CandidateUrls = string | string[]

  // Helper to clean STUN URLs (remove query params that Safari doesn't like)
  const cleanStunUrl = (url: string): string => {
    if (url.startsWith('stun:') || url.startsWith('stuns:')) {
      // Remove query parameters from STUN URLs (Safari compatibility)
      return url.split('?')[0]
    }
    // Keep TURN URLs as-is (they may need query params for credentials)
    return url
  }

  const normalizedUrls = raw
    .map((entry): CandidateUrls | null => {
      if (typeof entry === 'string') {
        return cleanStunUrl(entry)
      }
      if (entry && typeof entry === 'object' && 'urls' in entry) {
        const urls = entry.urls
        if (typeof urls === 'string') {
          return cleanStunUrl(urls)
        }
        if (Array.isArray(urls) && urls.every((u) => typeof u === 'string')) {
          return urls.map(cleanStunUrl)
        }
      }
      return null
    })
    .filter((urls): urls is CandidateUrls => urls !== null)

  if (normalizedUrls.length === 0) {
    console.warn('No valid ICE servers after formatting, using defaults')
    return defaultIceServers()
  }

  const validated = normalizedUrls
    .map<RTCIceServer>((urls) => ({ urls }))
    .filter((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
      return urls.every((url) => {
        if (typeof url !== 'string') return false
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
