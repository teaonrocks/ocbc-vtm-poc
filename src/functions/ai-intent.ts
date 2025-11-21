import { createServerFn } from '@tanstack/react-start'

export interface BankingIntentResult {
  intent: 'Remittance' | 'Loan' | 'CardReplacement' | 'UpdateBook' | 'CardApp'
  amount?: number
  recipient?: string
  duration?: number
}

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate'
const MODEL = 'llama3.2:3b'

const SYSTEM_PROMPT = `You are a banking assistant that extracts structured information from user voice commands. 
Your task is to analyze the user's request and output ONLY valid JSON with the following structure:
{
  "intent": "Remittance" | "Loan" | "CardReplacement" | "UpdateBook" | "CardApp",
  "amount": number (if applicable),
  "recipient": string (if applicable, for Remittance),
  "duration": number (if applicable, for Loan in months)
}

Rules:
- Intent must be one of: Remittance, Loan, CardReplacement, UpdateBook, CardApp
- For Remittance: extract amount and recipient name
- For Loan: extract amount and duration in months
- For CardReplacement, UpdateBook, CardApp: only intent is needed
- If amount is mentioned, extract it as a number
- Output ONLY the JSON object, no additional text or explanation`

export const analyzeIntent = createServerFn({
  method: 'POST',
})
  .inputValidator((d: { text: string }) => {
    if (!d || typeof d.text !== 'string' || d.text.trim().length === 0) {
      throw new Error('Text input is required')
    }
    return d
  })
  .handler(async ({ data }) => {
    const { text } = data

    try {
      const prompt = `${SYSTEM_PROMPT}\n\nUser request: "${text}"\n\nJSON:`

      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          stream: false,
          format: 'json',
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      const responseText = result.response || result.text || ''

      // Try to extract JSON from the response
      let jsonText = responseText.trim()

      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

      // Try to find JSON object in the response
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }

      const parsed = JSON.parse(jsonText) as BankingIntentResult

      // Validate intent
      const validIntents = ['Remittance', 'Loan', 'CardReplacement', 'UpdateBook', 'CardApp']
      if (!validIntents.includes(parsed.intent)) {
        throw new Error(`Invalid intent: ${parsed.intent}`)
      }

      return parsed
    } catch (error) {
      console.error('Intent analysis error:', error)

      // Fallback: Simple keyword matching for demo purposes
      const lowerText = text.toLowerCase()

      if (lowerText.includes('remittance') || lowerText.includes('transfer') || lowerText.includes('send money')) {
        const amountMatch = lowerText.match(/(\d+(?:\.\d+)?)/)
        const recipientMatch = lowerText.match(/(?:to|for)\s+([a-z]+(?:\s+[a-z]+)*)/i)

        return {
          intent: 'Remittance',
          amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
          recipient: recipientMatch ? recipientMatch[1].trim() : undefined,
        } as BankingIntentResult
      }

      if (lowerText.includes('loan') || lowerText.includes('borrow')) {
        const amountMatch = lowerText.match(/(\d+(?:\.\d+)?)/)
        const durationMatch = lowerText.match(/(\d+)\s*(?:month|months|year|years)/i)

        return {
          intent: 'Loan',
          amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
          duration: durationMatch ? parseInt(durationMatch[1]) : undefined,
        } as BankingIntentResult
      }

      if (lowerText.includes('card') && (lowerText.includes('replace') || lowerText.includes('replacement'))) {
        return { intent: 'CardReplacement' } as BankingIntentResult
      }

      if (lowerText.includes('bank book') || lowerText.includes('passbook') || lowerText.includes('update book')) {
        return { intent: 'UpdateBook' } as BankingIntentResult
      }

      if (lowerText.includes('card') && (lowerText.includes('apply') || lowerText.includes('application'))) {
        return { intent: 'CardApp' } as BankingIntentResult
      }

      // Default fallback
      throw new Error(`Could not determine intent from: "${text}"`)
    }
  })


