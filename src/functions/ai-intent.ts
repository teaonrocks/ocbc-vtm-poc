import { createServerFn } from '@tanstack/react-start'

export interface BankingIntentResult {
  intent:
    | 'Remittance'
    | 'Loan'
    | 'CardReplacement'
    | 'UpdateBook'
    | 'CardApp'
    | 'ClarificationNeeded'
  amount?: number
  recipient?: string
  duration?: number
  responseText: string
  translatedText?: string
}

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate'
const MODEL = 'llama3.2:latest'

const CJK_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/
const TAMIL_REGEX = /[\u0B80-\u0BFF]/
const ASCII_LETTER_REGEX = /[a-z]/i
const MALAY_LANGUAGE_CODES = new Set(['ms', 'msa', 'zsm'])

function normalizeLanguageCode(code?: string | null): string | null {
  if (!code) return null
  const trimmed = code.trim()
  if (!trimmed) return null
  const normalized = trimmed.toLowerCase()
  if (normalized === 'unknown') return null
  if (normalized === 'english') return 'en'
  if (normalized === 'chinese' || normalized === 'cmn') return 'zh'
  if (normalized.startsWith('zh')) return 'zh'
  if (normalized.startsWith('en')) return 'en'
  if (normalized === 'tamil') return 'ta'
  if (normalized === 'malay' || MALAY_LANGUAGE_CODES.has(normalized)) {
    return 'ms'
  }
  return normalized
}

const SYSTEM_PROMPT = `You are a banking assistant that extracts structured information from user voice commands. 
Your task is to analyze the user's request and output ONLY valid JSON with the following structure:
{
  "intent": "Remittance" | "Loan" | "CardReplacement" | "UpdateBook" | "CardApp" | "ClarificationNeeded",
  "amount": number (if applicable),
  "recipient": string (if applicable, for Remittance),
  "duration": number (if applicable, for Loan in months),
  "responseText": string (a concise friendly sentence acknowledging what action you'll perform)
}

Rules:
- Intent must be one of: Remittance, Loan, CardReplacement, UpdateBook, CardApp, ClarificationNeeded.
- If the request is unclear, set intent to ClarificationNeeded and write a short question asking the user to clarify.
- For Remittance: extract amount and recipient name.
- For Loan: extract amount and duration in months.
- For CardReplacement, UpdateBook, CardApp: only intent is needed.
- If amount is mentioned, extract it as a number.
- responseText must be a natural one-sentence acknowledgement (<=220 characters) describing how you will help the user next. Do not include markdown or placeholders.

Standard responseText styles (adapt values for the specific user request):
- For Remittance (use amount and recipient when known):
  * "I'll help you transfer {amount} to {recipient} now. Please confirm the details on screen before we send the money."
  * "Your funds transfer to {recipient} for {amount} is ready. Review and confirm on screen to complete the remittance."
- For Loan:
  * "I'll start your loan application for {amount} over {duration} months. Please review the summary on screen."
  * "Your request for a {amount} loan is being prepared. Confirm the loan amount and tenure on screen to continue."
- For CardReplacement:
  * "I'll block your current card and request a replacement right away. Please confirm your card details on screen."
- For UpdateBook:
  * "I'll update your bank book with your latest transactions now. Please keep the passbook in the slot until the update finishes."
- For CardApp:
  * "I'll start a new card application for you. Please review the product details and confirm on screen."
- For ClarificationNeeded:
  * "I'm not sure which service you need. Are you trying to make a remittance, apply for a loan, replace a card, update your bank book, or apply for a new card?"

- Choose ONE suitable style and substitute any known numbers, names, or durations.
- Output ONLY the JSON object, no additional text or explanation.`

function looksEnglish(text: string): boolean {
  if (!text) return false
  if (CJK_REGEX.test(text) || TAMIL_REGEX.test(text)) return false

  if (!ASCII_LETTER_REGEX.test(text)) {
    return false
  }

  const cleaned = text.replace(/[^a-zA-Z\s]/g, '')
  const letterRatio = cleaned.length / Math.max(text.length, 1)
  if (letterRatio < 0.6) {
    return false
  }

  return true
}

async function translateToEnglishIfNeeded(
  text: string,
  languageCode?: string | null,
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) {
    return trimmed
  }

  const normalizedLanguage = normalizeLanguageCode(languageCode)
  const needsTranslation = normalizedLanguage
    ? normalizedLanguage !== 'en'
    : !looksEnglish(trimmed)

  if (!needsTranslation) {
    return trimmed
  }

  const languageIntro = normalizedLanguage
    ? `Detected language code: ${normalizedLanguage}.\n`
    : ''

  const basePrompt = `${languageIntro}Translate the following user utterance into natural English.
Return ONLY the translated English text with no quotes or commentary.

Utterance:
"""${trimmed}"""`

  const forcedPrompt = `You are a professional translator. Output ONLY the English translation of the following user utterance.
If the input is not in English, do not repeat it—respond using English words and ASCII characters only.
If the input is already in English, copy it verbatim.

Utterance:
"""${trimmed}"""`

  const attemptTranslation = async (prompt: string) => {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Ollama translation error: ${response.status} ${response.statusText}`,
      )
    }

    const result = await response.json()
    return (
      (typeof result.response === 'string' ? result.response : '') ||
      (typeof result.text === 'string' ? result.text : '')
    )
  }

  const cleanTranslation = (raw: string) =>
    raw
      .replace(/```(?:text)?/g, '')
      .replace(/^['"\s]+/, '')
      .replace(/['"\s]+$/, '')
      .trim()

  try {
    let translated = cleanTranslation(await attemptTranslation(basePrompt))

    if (!translated || translated === trimmed || !looksEnglish(translated)) {
      const fallback = cleanTranslation(await attemptTranslation(forcedPrompt))
      if (fallback) {
        translated = fallback
      }
    }

    if (!translated || !looksEnglish(translated)) {
      console.warn('Translation remained non-English, using original text', {
        languageHint: normalizedLanguage ?? 'heuristic',
      })
      return trimmed
    }

    console.log('Intent translation applied', {
      originalLength: trimmed.length,
      translatedLength: translated.length,
      languageHint: normalizedLanguage ?? 'heuristic',
    })

    return translated
  } catch (error) {
    console.error('Intent translation failed, using original text', error)
    return trimmed
  }
}

type AnalyzeIntentInput = {
  text: string
  language?: string | null
}

type IntentCore = Omit<BankingIntentResult, 'responseText'>

const HIGH_VALUE_ESCALATION_INTENTS: Array<IntentCore['intent']> = [
  'Loan',
  'CardReplacement',
]

function requiresAgentEscalation(intent: IntentCore['intent']): boolean {
  return HIGH_VALUE_ESCALATION_INTENTS.includes(intent)
}

function buildHighValueResponse(intent: IntentCore['intent']): string {
  if (intent === 'Loan') {
    return `I'm sorry, I can't complete a loan request on this kiosk because it's a high value transaction. Let me connect you to a live agent to finish it.`
  }
  if (intent === 'CardReplacement') {
    return `I'm sorry, card replacement is a high value security request. I'll connect you to a live agent so they can complete it safely with you.`
  }
  return `I'm sorry, this request needs a live agent to finish. Please connect with them now.`
}

function withResponseText(
  action: IntentCore & { responseText?: string },
): BankingIntentResult {
  const needsEscalationCopy = requiresAgentEscalation(action.intent)
  const trimmed =
    typeof action.responseText === 'string'
      ? action.responseText.trim()
      : undefined

  if (needsEscalationCopy) {
    return { ...action, responseText: buildHighValueResponse(action.intent) }
  }

  if (trimmed && trimmed.length > 0) {
    return { ...action, responseText: trimmed }
  }

  return { ...action, responseText: buildDefaultResponse(action) }
}

function buildDefaultResponse(action: IntentCore): string {
  if (requiresAgentEscalation(action.intent)) {
    return buildHighValueResponse(action.intent)
  }

  switch (action.intent) {
    case 'Remittance': {
      const amountText =
        typeof action.amount === 'number'
          ? `$${action.amount.toLocaleString()}`
          : 'the amount you specified'
      const recipientText = action.recipient ? ` to ${action.recipient}` : ''
      return `I can help you send ${amountText}${recipientText}. Please review the transfer details on screen.`
    }
    case 'UpdateBook':
      return `I'll update your bank book with the latest transactions now.`
    case 'CardApp':
      return `I'll get your new credit card application submitted right away.`
    default:
      return `I'll guide you through the requested banking step.`
  }
}

export const analyzeIntent = createServerFn({
  method: 'POST',
})
  .inputValidator((d: AnalyzeIntentInput) => {
    if (!d || typeof d.text !== 'string' || d.text.trim().length === 0) {
      throw new Error('Text input is required')
    }
    if (
      d.language !== undefined &&
      d.language !== null &&
      typeof d.language !== 'string'
    ) {
      throw new Error('Language must be a string when provided')
    }
    return d
  })
  .handler(async ({ data }) => {
    const originalText = data.text
    const textForIntent = await translateToEnglishIfNeeded(
      originalText,
      data.language,
    )

    try {
      const prompt = `${SYSTEM_PROMPT}\n\nUser request: "${textForIntent}"\n\nJSON:`

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
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`,
        )
      }

      const result = await response.json()
      const responseText = result.response || result.text || ''

      // Try to extract JSON from the response
      let jsonText = responseText.trim()

      // Remove markdown code blocks if present
      jsonText = jsonText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      // Try to find JSON object in the response
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }

      const parsed = JSON.parse(jsonText) as Partial<BankingIntentResult>

      // Validate intent
      const validIntents = [
        'Remittance',
        'Loan',
        'CardReplacement',
        'UpdateBook',
        'CardApp',
        'ClarificationNeeded',
      ]
      const parsedIntent = parsed.intent
      if (
        typeof parsedIntent !== 'string' ||
        !validIntents.includes(parsedIntent as BankingIntentResult['intent'])
      ) {
        throw new Error(`Invalid intent: ${parsed.intent}`)
      }

      const intent = parsedIntent as BankingIntentResult['intent']

      const sanitized = withResponseText({
        intent,
        amount:
          typeof parsed.amount === 'number' ? Number(parsed.amount) : undefined,
        recipient:
          typeof parsed.recipient === 'string'
            ? parsed.recipient.trim()
            : undefined,
        duration:
          typeof parsed.duration === 'number'
            ? Number(parsed.duration)
            : undefined,
        responseText:
          typeof parsed.responseText === 'string'
            ? parsed.responseText
            : undefined,
        translatedText: textForIntent,
      })

      return sanitized
    } catch (error) {
      console.error('Intent analysis error:', error)

      // Fallback: Simple keyword matching for demo purposes
      const lowerText = originalText.toLowerCase()

      if (
        lowerText.includes('remittance') ||
        lowerText.includes('transfer') ||
        lowerText.includes('send money')
      ) {
        const amountMatch = lowerText.match(/(\d+(?:\.\d+)?)/)
        const recipientMatch = lowerText.match(
          /(?:to|for)\s+([a-z]+(?:\s+[a-z]+)*)/i,
        )

        return withResponseText({
          intent: 'Remittance',
          amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
          recipient: recipientMatch ? recipientMatch[1].trim() : undefined,
          translatedText: textForIntent,
        })
      }

      if (lowerText.includes('loan') || lowerText.includes('borrow')) {
        const amountMatch = lowerText.match(/(\d+(?:\.\d+)?)/)
        const durationMatch = lowerText.match(
          /(\d+)\s*(?:month|months|year|years)/i,
        )

        return withResponseText({
          intent: 'Loan',
          amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
          duration: durationMatch ? parseInt(durationMatch[1]) : undefined,
          translatedText: textForIntent,
        })
      }

      if (
        lowerText.includes('card') &&
        (lowerText.includes('replace') || lowerText.includes('replacement'))
      ) {
        return withResponseText({
          intent: 'CardReplacement',
          translatedText: textForIntent,
        })
      }

      if (
        lowerText.includes('bank book') ||
        lowerText.includes('passbook') ||
        lowerText.includes('update book')
      ) {
        return withResponseText({
          intent: 'UpdateBook',
          translatedText: textForIntent,
        })
      }

      if (
        lowerText.includes('card') &&
        (lowerText.includes('apply') || lowerText.includes('application'))
      ) {
        return withResponseText({
          intent: 'CardApp',
          translatedText: textForIntent,
        })
      }

      return withResponseText({
        intent: 'ClarificationNeeded',
        responseText:
          "I didn't quite catch that. Are you trying to make a remittance, loan, card replacement, update book, or card application request? Please say it again.",
        translatedText: textForIntent,
      })
    }
  })
