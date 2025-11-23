import { Ticket, TicketStatus } from '../types/ticket'
import { Clock, AlertCircle, User, MapPin, Hash } from 'lucide-react'

interface TicketCardProps {
  ticket: Ticket
  onClick: () => void
}

export default function TicketCard({ ticket, onClick }: TicketCardProps) {
  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case TicketStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case TicketStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case TicketStatus.RESOLVED:
        return 'bg-green-100 text-green-800 border-green-300'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-orange-100 text-orange-800'
      case 'low':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTime = (timestamp: string | number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-6 cursor-pointer border-l-4 border-[#E1251B]"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Ticket #{ticket.id.slice(0, 8)}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={14} />
            <span>{formatTime(ticket.timestamp)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status as TicketStatus)}`}>
            {ticket.status.replace('-', ' ').toUpperCase()}
          </span>
          {ticket.priority && (
            <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
              {ticket.priority.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {(ticket.atmId || ticket.source) && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <MapPin size={16} className="text-[#E1251B]" />
            <span className="font-medium">Source:</span>
            <span>{ticket.atmId || ticket.source || 'N/A'}</span>
          </div>
        )}
        {ticket.sessionId && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Hash size={16} className="text-[#E1251B]" />
            <span className="font-medium">Session:</span>
            <code className="font-mono text-xs text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
              {ticket.sessionId}
            </code>
          </div>
        )}
        {(ticket.customerName || ticket.customerId) && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <User size={16} className="text-[#E1251B]" />
            <span className="font-medium">Customer:</span>
            <span>{ticket.customerName || ticket.customerId}</span>
          </div>
        )}
        {ticket.issueType && (
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <AlertCircle size={16} className="text-[#E1251B] mt-0.5" />
            <div>
              <span className="font-medium">Issue:</span>
              <p className="text-gray-600 mt-1">{ticket.issueType}</p>
            </div>
          </div>
        )}
      </div>

      {ticket.description && (
        <p className="text-sm text-gray-600 line-clamp-2">
          {ticket.description}
        </p>
      )}
      {!ticket.description && !ticket.issueType && (
        <p className="text-sm text-gray-600 italic">
          VTM Live Agent Request
        </p>
      )}
    </div>
  )
}
