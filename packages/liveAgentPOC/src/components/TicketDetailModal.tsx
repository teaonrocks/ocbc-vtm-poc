import { useState } from 'react'
import { Ticket, TicketStatus } from '../types/ticket'
import { X, Clock, MapPin, User, AlertCircle, CheckCircle, Copy } from 'lucide-react'

interface TicketDetailModalProps {
  ticket: Ticket
  onClose: () => void
  onUpdateStatus: (ticketId: string, status: TicketStatus) => void
  onStartSession?: (ticket: Ticket) => void
  onResolveTicket?: (ticket: Ticket) => void
}

export default function TicketDetailModal({
  ticket,
  onClose,
  onUpdateStatus,
  onStartSession,
  onResolveTicket,
}: TicketDetailModalProps) {
  const [copied, setCopied] = useState(false)
  const formatDateTime = (timestamp: string | number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const handleStatusChange = (status: TicketStatus) => {
    onUpdateStatus(ticket.id, status)
  }

  const handleCopySessionId = async () => {
    if (!ticket.sessionId) {
      return
    }
    try {
      await navigator.clipboard.writeText(ticket.sessionId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy session ID', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#E1251B] text-white p-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Ticket #{ticket.id.slice(0, 8)}
            </h2>
            <div className="flex items-center gap-2 text-white/90">
              <Clock size={16} />
              <span className="text-sm">{formatDateTime(ticket.timestamp)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and Priority */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="px-4 py-2 bg-gray-100 rounded-lg font-medium">
                {ticket.status.replace('-', ' ').toUpperCase()}
              </div>
            </div>
            {ticket.priority && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <div className="px-4 py-2 bg-gray-100 rounded-lg font-medium">
                  {ticket.priority.toUpperCase()}
                </div>
              </div>
            )}
          </div>

          {/* ATM/Source Information */}
          {(ticket.atmId || ticket.source) && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 mb-3">Source Information</h3>
              <div className="flex items-center gap-3">
                <MapPin size={20} className="text-[#E1251B]" />
                <div>
                  <span className="text-sm text-gray-600">Source:</span>
                  <p className="font-medium">{ticket.atmId || ticket.source}</p>
                </div>
              </div>
            </div>
          )}

          {ticket.sessionId && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900 mb-3">
                Session Details
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-sm bg-white px-3 py-2 rounded border border-gray-200">
                  {ticket.sessionId}
                </code>
                <button
                  onClick={handleCopySessionId}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Copy size={16} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-gray-500">
                Share this session ID with the signaling console if you need to
                join manually.
              </p>
            </div>
          )}

          {/* Customer Information */}
          {(ticket.customerName || ticket.customerId) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">
                Customer Information
              </h3>
              <div className="flex items-center gap-3">
                <User size={20} className="text-[#E1251B]" />
                <div>
                  <span className="text-sm text-gray-600">Customer:</span>
                  <p className="font-medium">{ticket.customerName || ticket.customerId}</p>
                </div>
              </div>
            </div>
          )}

          {/* Issue Details */}
          {(ticket.issueType || ticket.description) && (
            <div className="space-y-3">
              {ticket.issueType && (
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-[#E1251B] mt-1" />
                  <div className="flex-1">
                    <span className="text-sm text-gray-600">Issue Type:</span>
                    <p className="font-semibold text-gray-900">{ticket.issueType}</p>
                  </div>
                </div>
              )}
              {ticket.description && (
                <div className="pl-8">
                  <span className="text-sm text-gray-600">Description:</span>
                  <p className="mt-1 text-gray-900">{ticket.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {ticket.status !== TicketStatus.IN_PROGRESS && (
              <button
                onClick={() => {
                  if (onStartSession) {
                    onStartSession(ticket)
                  } else {
                    handleStatusChange(TicketStatus.IN_PROGRESS)
                  }
                }}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Start Working
              </button>
            )}
            {ticket.status !== TicketStatus.RESOLVED && (
              <button
                onClick={() => {
                  if (onResolveTicket) {
                    onResolveTicket(ticket)
                  } else {
                    handleStatusChange(TicketStatus.RESOLVED)
                  }
                }}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle size={20} />
                Mark as Resolved
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
