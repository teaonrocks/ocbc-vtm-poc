import cors from 'cors'
import express from 'express'
import { createServer } from 'https'
import { readFileSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { WebSocket, WebSocketServer } from 'ws'

type Role = 'vtm' | 'agent'

type SignalingKind = 'offer' | 'answer' | 'ice' | 'hangup' | 'peer-ready'

type SignalingEnvelope = {
  type: SignalingKind | 'error' | 'heartbeat' | 'peer-update'
  payload?: unknown
  senderRole?: Role
}

type Participant = {
  id: string
  role: Role
  socket: WebSocket
}

type Session = {
  id: string
  participants: Map<string, Participant>
  createdAt: number
}

const app = express()
app.use(cors())
app.use(express.json())

const PORT = Number(process.env.SIGNALING_PORT ?? process.env.PORT ?? 4100)

const defaultStuns = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:global.stun.twilio.com:3478?transport=udp',
]

const iceServers = [
  ...(process.env.STUN_SERVERS
    ? process.env.STUN_SERVERS.split(',').map((entry) => entry.trim())
    : defaultStuns),
  ...(process.env.TURN_SERVERS
    ? process.env.TURN_SERVERS.split(',').map((entry) => entry.trim())
    : []),
]
  .filter(Boolean)
  .map((urls) => ({ urls }))

const sessions = new Map<string, Session>()

app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    activeSessions: sessions.size,
    iceServers,
  })
})

app.get('/sessions', (_req, res) => {
  res.json(
    Array.from(sessions.values()).map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      participantCount: session.participants.size,
    })),
  )
})

app.post('/sessions', (_req, res) => {
  const sessionId = nanoid(8).toUpperCase()
  const session: Session = {
    id: sessionId,
    participants: new Map(),
    createdAt: Date.now(),
  }
  sessions.set(sessionId, session)

  res.json({
    sessionId,
    iceServers,
  })
})

app.delete('/sessions/:id', (req, res) => {
  const { id } = req.params
  const existed = sessions.delete(id)
  res.status(existed ? 204 : 404).end()
})

// Load SSL certificates from workspace root
const certPath = join(__dirname, '..', '..', '..', 'cert.pem')
const keyPath = join(__dirname, '..', '..', '..', 'cert-key.pem')

const server = createServer(
  {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  },
  app,
)
const wss = new WebSocketServer({ server, path: '/ws' })

function closeSessionIfEmpty(sessionId: string) {
  const session = sessions.get(sessionId)
  if (!session) {
    return
  }
  if (session.participants.size === 0) {
    sessions.delete(sessionId)
  }
}

function broadcast(
  sessionId: string,
  message: SignalingEnvelope,
  excludeParticipantId?: string,
) {
  const session = sessions.get(sessionId)
  if (!session) {
    return
  }
  const payload = JSON.stringify(message)
  session.participants.forEach((participant) => {
    if (participant.id === excludeParticipantId) {
      return
    }
    if (participant.socket.readyState === WebSocket.OPEN) {
      participant.socket.send(payload)
    }
  })
}

wss.on('connection', (socket, req) => {
  try {
    const requestUrl = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? 'localhost'}`,
    )
    const sessionId = requestUrl.searchParams.get('sessionId')
    const role = (requestUrl.searchParams.get('role') ?? 'vtm') as Role

    if (!sessionId || !sessions.has(sessionId)) {
      socket.send(
        JSON.stringify({
          type: 'error',
          payload: { message: 'Session not found' },
        } satisfies SignalingEnvelope),
      )
      socket.close()
      return
    }

    const participantId = nanoid()
    const session = sessions.get(sessionId)!
    const participant: Participant = {
      id: participantId,
      role,
      socket,
    }

    session.participants.set(participantId, participant)

    socket.send(
      JSON.stringify({
        type: 'peer-update',
        payload: { participants: session.participants.size },
      } satisfies SignalingEnvelope),
    )

    broadcast(
      sessionId,
      {
        type: 'peer-update',
        senderRole: role,
        payload: { participants: session.participants.size },
      },
      participantId,
    )

    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'heartbeat' }))
      }
    }, 25000)

    socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as SignalingEnvelope
        if (
          parsed.type === 'offer' ||
          parsed.type === 'answer' ||
          parsed.type === 'ice' ||
          parsed.type === 'hangup' ||
          parsed.type === 'peer-ready'
        ) {
          broadcast(
            sessionId,
            {
              ...parsed,
              senderRole: role,
            },
            participantId,
          )
        }
      } catch (err) {
        console.error('Failed to relay message', err)
      }
    })

    const cleanup = () => {
      clearInterval(heartbeat)
      socket.removeAllListeners()
      session.participants.delete(participantId)
      broadcast(
        sessionId,
        {
          type: 'hangup',
          senderRole: role,
        },
        participantId,
      )
      closeSessionIfEmpty(sessionId)
    }

    socket.on('close', cleanup)
    socket.on('error', cleanup)
  } catch (err) {
    console.error('WebSocket connection error', err)
    socket.close()
  }
})

server.listen(PORT, () => {
  console.log(`Signaling server listening on https://localhost:${PORT}`)
})

