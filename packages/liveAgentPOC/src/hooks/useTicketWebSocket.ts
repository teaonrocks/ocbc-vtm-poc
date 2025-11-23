import { useState, useEffect, useCallback } from 'react'
import { Ticket, TicketStatus } from '../types/ticket'

const derivedFromApi = (() => {
  const apiUrl = import.meta.env.VITE_LIVE_AGENT_API_URL
  if (!apiUrl) {
    return null
  }
  try {
    const api = new URL(apiUrl)
    api.protocol = api.protocol === 'https:' ? 'wss:' : 'ws:'
    api.pathname = '/'
    api.search = ''
    api.hash = ''
    return api.toString().replace(/\/$/, '')
  } catch {
    return null
  }
})()

const WS_URL =
  import.meta.env.VITE_LIVE_AGENT_WS_URL ??
  derivedFromApi ??
  'wss://localhost:8081' // WebSocket server URL

export function useTicketWebSocket() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    console.log('🔌 Attempting to connect to WebSocket server...')
    const websocket = new WebSocket(WS_URL)

    websocket.onopen = () => {
      console.log('✅ WebSocket connected to Live Agent server')
      setIsConnected(true)
      
      // Identify as agent client
      websocket.send(JSON.stringify({
        type: 'identify',
        clientType: 'agent',
      }))
    }

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('📨 Received message:', data.type)
        
        if (data.type === 'connection_established') {
          console.log('🎉', data.message)
        } else if (data.type === 'new_ticket') {
          console.log('🎫 New ticket received:', data.ticket.id.slice(0, 8))
          setTickets(prev => [data.ticket, ...prev])
        } else if (data.type === 'update_ticket') {
          console.log('📝 Ticket status updated:', data.ticketId.slice(0, 8))
          setTickets(prev => 
            prev.map(t => 
              t.id === data.ticketId 
                ? { ...t, status: data.status } 
                : t
            )
          )
        }
      } catch (error) {
        console.error('❌ Error processing WebSocket message:', error)
      }
    }

    websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
      setIsConnected(false)
    }

    websocket.onclose = () => {
      console.log('❌ WebSocket disconnected')
      setIsConnected(false)
    }

    setWs(websocket)

    return () => {
      console.log('🔌 Closing WebSocket connection')
      websocket.close()
    }
  }, [])

  const updateTicketStatus = useCallback((ticketId: string, status: TicketStatus) => {
    // Update locally first for immediate UI feedback
    setTickets(prev =>
      prev.map(ticket =>
        ticket.id === ticketId ? { ...ticket, status } : ticket
      )
    )

    // Send update to server via WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('📤 Sending status update to server')
      ws.send(JSON.stringify({
        type: 'update_ticket_status',
        ticketId,
        status,
      }))
    } else {
      console.warn('⚠️ WebSocket not connected, status update not sent to server')
    }
  }, [ws])

  const addTicket = useCallback((ticket: Ticket) => {
    setTickets(prev => [ticket, ...prev])
  }, [])

  return {
    tickets,
    isConnected,
    updateTicketStatus,
    addTicket,
  }
}
