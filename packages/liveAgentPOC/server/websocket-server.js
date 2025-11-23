// WebSocket Server for receiving tickets from VTM
// Run this with: node server/websocket-server.js

import fs from 'fs'
import http from 'http'
import https from 'https'
import { WebSocketServer } from 'ws'

// Minimal .env loader so the bridge can pick up LIVE_AGENT_* vars
function loadEnvFromFile(filename) {
  try {
    const contents = fs.readFileSync(filename, 'utf-8')
    contents
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .forEach((line) => {
        const idx = line.indexOf('=')
        if (idx === -1) return
        const key = line.slice(0, idx).trim()
        let value = line.slice(idx + 1).trim()
        // Strip optional surrounding quotes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (!(key in process.env)) {
          process.env[key] = value
        }
      })
  } catch {
    // Ignore missing or unreadable env files
  }
}

// Load env from standard Vite-style locations in the package root
loadEnvFromFile('.env')
loadEnvFromFile('.env.local')

const PORT = Number(process.env.LIVE_AGENT_PORT ?? 8081)
const certPath = process.env.LIVE_AGENT_TLS_CERT
const keyPath = process.env.LIVE_AGENT_TLS_KEY
const useHttps = Boolean(certPath && keyPath)

console.log('🔧 Live Agent bridge config:')
console.log('  LIVE_AGENT_PORT:', PORT)
console.log('  LIVE_AGENT_TLS_CERT:', certPath ?? '(not set)')
console.log('  LIVE_AGENT_TLS_KEY:', keyPath ?? '(not set)')
console.log('  CWD:', process.cwd())
console.log('  TLS requested:', useHttps ? 'yes' : 'no (missing cert/key)')

// Store connected clients
const clients = new Set()

const requestListener = (req, res) => {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/api/ticket') {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk.toString()
    })

    req.on('end', () => {
      try {
        const ticket = JSON.parse(body)
        console.log('📥 Received ticket from VTM:', ticket.id.slice(0, 8))

        // Broadcast to all connected WebSocket clients (Live Agent dashboards)
        broadcastToClients({
          type: 'new_ticket',
          ticket,
        })

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, message: 'Ticket received' }))
      } catch (error) {
        console.error('❌ Error processing ticket:', error)
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: error.message }))
      }
    })
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
}

function createServerWithOptionalTls() {
  if (useHttps) {
    try {
      const cert = fs.readFileSync(certPath)
      const key = fs.readFileSync(keyPath)
      return {
        server: https.createServer({ cert, key }, requestListener),
        protocol: 'https',
      }
    } catch (error) {
      console.warn(
        'Failed to read TLS certificate or key for Live Agent bridge. Falling back to HTTP.',
        error,
      )
    }
  }

  return {
    server: http.createServer(requestListener),
    protocol: 'http',
  }
}

const { server, protocol } = createServerWithOptionalTls()
const wsProtocol = protocol === 'https' ? 'wss' : 'ws'

// Create WebSocket server
const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  const socket = req?.socket
  const remoteAddress = socket?.remoteAddress ?? 'unknown'
  const remotePort = socket?.remotePort ?? 'unknown'
  const forwardedFor = req?.headers?.['x-forwarded-for']
  const origin = req?.headers?.origin
  const userAgent = req?.headers?.['user-agent']
  const isTls = socket && 'encrypted' in socket && socket.encrypted === true

  console.log('✅ Live Agent dashboard connected')
  console.log('   ↳ Remote address:', remoteAddress, 'port:', remotePort)
  if (forwardedFor) {
    console.log('   ↳ X-Forwarded-For:', forwardedFor)
  }
  if (origin) {
    console.log('   ↳ Origin:', origin)
  }
  if (userAgent) {
    console.log('   ↳ User-Agent:', userAgent)
  }
  console.log('   ↳ Transport:', isTls ? 'TLS (wss)' : 'TCP (ws)')
  console.log('   ↳ Request URL:', req?.url ?? '(unknown)')

  clients.add(ws)

  // Send connection confirmation
  ws.send(
    JSON.stringify({
      type: 'connection_established',
      message: 'Connected to Live Agent server',
    }),
  )

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString())
      console.log('📨 Received from Live Agent:', data.type)

      // Handle different message types
      if (data.type === 'update_ticket_status') {
        console.log(
          `📝 Ticket ${data.ticketId.slice(0, 8)} status updated to ${data.status}`,
        )
        // Broadcast status update to all clients
        broadcastToClients({
          type: 'update_ticket',
          ticketId: data.ticketId,
          status: data.status,
        })
      }
    } catch (error) {
      console.error('❌ Error processing message:', error)
    }
  })

  ws.on('close', () => {
    console.log('❌ Live Agent dashboard disconnected')
    clients.delete(ws)
  })

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error)
    clients.delete(ws)
  })
})

function broadcastToClients(data) {
  const message = JSON.stringify(data)
  const activeClients = Array.from(clients).filter(
    (client) => client.readyState === 1,
  )

  console.log(`📡 Broadcasting to ${activeClients.length} connected client(s)`)

  activeClients.forEach((client) => {
    client.send(message)
  })
}

server.listen(PORT, () => {
  console.log('='.repeat(60))
  console.log('🚀 Live Agent Server Started')
  console.log('='.repeat(60))
  console.log(
    `🔐 TLS: ${protocol === 'https' ? 'ENABLED (HTTPS/WSS)' : 'DISABLED (HTTP/WS)'}`,
  )
  console.log(`📡 WebSocket server: ${wsProtocol}://0.0.0.0:${PORT}`)
  console.log(`🌐 HTTP API server: ${protocol}://0.0.0.0:${PORT}`)
  console.log(`📮 VTM endpoint: ${protocol}://0.0.0.0:${PORT}/api/ticket`)
  console.log('='.repeat(60))
  console.log('Waiting for connections...')
  console.log('')
})
