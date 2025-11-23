import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { useTicketWebSocket } from '../hooks/useTicketWebSocket'
import TicketCard from '../components/TicketCard'
import TicketDetailModal from '../components/TicketDetailModal'
import { Ticket, TicketStatus } from '../types/ticket'
import { Headset, Wifi, WifiOff, Filter } from 'lucide-react'
import { useAgentSession } from '../hooks/useAgentSession'
import { LiveSessionPanel } from '../components/LiveSessionPanel'

export const Route = createFileRoute('/home')({ component: HomePage })

function HomePage() {
  const { tickets, isConnected, updateTicketStatus } = useTicketWebSocket()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)

  const {
    callState,
    callError,
    activeSessionId,
    localStream,
    remoteCameraStream,
    remoteScreenStream,
    remoteAudioStream,
    joinSession,
    hangUp,
  } = useAgentSession()

  const filteredTickets = tickets.filter(ticket => 
    statusFilter === 'all' || ticket.status === statusFilter
  )

  const pendingCount = tickets.filter(t => t.status === TicketStatus.PENDING).length
  const inProgressCount = tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length
  const resolvedCount = tickets.filter(t => t.status === TicketStatus.RESOLVED).length

  const handleStartSession = useCallback(
    async (ticket: Ticket) => {
      if (!ticket.sessionId) {
        setSessionMessage('This ticket does not include a signaling session yet.')
        return
      }
      try {
        await joinSession(ticket.sessionId)
        updateTicketStatus(ticket.id, TicketStatus.IN_PROGRESS)
        setSessionMessage(null)
      } catch (error) {
        setSessionMessage(
          error instanceof Error
            ? error.message
            : 'Unable to join the kiosk session. Please try again.',
        )
      }
    },
    [joinSession, updateTicketStatus],
  )

  const handleResolveTicket = useCallback(
    (ticket: Ticket) => {
      updateTicketStatus(ticket.id, TicketStatus.RESOLVED)
      if (ticket.sessionId && ticket.sessionId === activeSessionId) {
        hangUp()
      }
      setSessionMessage(null)
    },
    [activeSessionId, hangUp, updateTicketStatus],
  )

  return (
    <div className="min-h-screen bg-linear-to-b from-[#E1251B] to-white">
      {/* Header */}
      <div className="bg-[#E1251B] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Headset size={40} />
              <div>
                <h1 className="text-3xl font-bold">Live Agent Dashboard</h1>
                <p className="text-white/80">ATM Support Ticket Management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi size={20} />
                  <span className="text-sm">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff size={20} />
                  <span className="text-sm">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-yellow-600 text-sm font-medium mb-1">PENDING</div>
            <div className="text-3xl font-bold">{pendingCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-blue-600 text-sm font-medium mb-1">IN PROGRESS</div>
            <div className="text-3xl font-bold">{inProgressCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-green-600 text-sm font-medium mb-1">RESOLVED</div>
            <div className="text-3xl font-bold">{resolvedCount}</div>
          </div>
        </div>

        {/* Live Session */}
        <div className="mb-6">
          <LiveSessionPanel
            callState={callState}
            callError={sessionMessage ?? callError}
            sessionId={activeSessionId}
            localStream={localStream}
            remoteCameraStream={remoteCameraStream}
            remoteScreenStream={remoteScreenStream}
            remoteAudioStream={remoteAudioStream}
            onHangUp={hangUp}
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4 mb-6 bg-white rounded-lg shadow p-4">
          <Filter size={20} className="text-gray-600" />
          <span className="font-medium text-gray-700">Filter:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[#E1251B] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter(TicketStatus.PENDING)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === TicketStatus.PENDING
                  ? 'bg-[#E1251B] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter(TicketStatus.IN_PROGRESS)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === TicketStatus.IN_PROGRESS
                  ? 'bg-[#E1251B] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setStatusFilter(TicketStatus.RESOLVED)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === TicketStatus.RESOLVED
                  ? 'bg-[#E1251B] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Resolved
            </button>
          </div>
        </div>

        {/* Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTickets.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500 text-lg">No tickets found</p>
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => setSelectedTicket(ticket)}
              />
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdateStatus={updateTicketStatus}
          onStartSession={handleStartSession}
          onResolveTicket={handleResolveTicket}
        />
      )}
    </div>
  )
}
