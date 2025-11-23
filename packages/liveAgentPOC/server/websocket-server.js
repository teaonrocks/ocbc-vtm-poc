// WebSocket Server for receiving tickets from VTM
// Run this with: node server/websocket-server.js

import fs from 'fs'
import http from 'http'
import https from 'https'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.LIVE_AGENT_PORT ?? 8081)
const certPath = process.env.LIVE_AGENT_TLS_CERT
const keyPath = process.env.LIVE_AGENT_TLS_KEY
const useHttps = Boolean(certPath && keyPath)

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

wss.on('connection', (ws) => {
  console.log('✅ Live Agent dashboard connected')
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
  console.log(`📡 WebSocket server: ${wsProtocol}://localhost:${PORT}`)
  console.log(`🌐 HTTP API server: ${protocol}://localhost:${PORT}`)
  console.log(`📮 VTM endpoint: ${protocol}://localhost:${PORT}/api/ticket`)
  console.log('='.repeat(60))
  console.log('Waiting for connections...')
  console.log('')
})
