const defaultApiUrl =
  import.meta.env.VITE_LIVE_AGENT_API_URL ??
  'https://localhost:8081/api/ticket'

export type LiveAgentTicketPayload = {
  sessionId: string
  ticketId?: string
  atmId?: string
  customerName?: string
  issueType?: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  metadata?: Record<string, unknown>
}

export type LiveAgentTicketResponse = {
  success: boolean
  message?: string
  ticketId?: string
  error?: string
}

/**
 * Sends a ticket notification to the Live Agent dashboard.
 */
export async function createLiveAgentTicket(
  payload: LiveAgentTicketPayload,
): Promise<LiveAgentTicketResponse> {
  const response = await fetch(defaultApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: payload.ticketId ?? crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      status: 'pending',
      ...payload,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      errorText || `Live Agent API responded with ${response.status}`,
    )
  }

  return response.json() as Promise<LiveAgentTicketResponse>
}

