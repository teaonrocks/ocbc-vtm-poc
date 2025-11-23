export enum TicketStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  RESOLVED = 'resolved',
}

export interface Ticket {
  id: string
  atmId?: string
  customerId?: string
  sessionId?: string
  timestamp: string | number
  status: TicketStatus | string
  customerName?: string
  issueType?: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  source?: string
}
