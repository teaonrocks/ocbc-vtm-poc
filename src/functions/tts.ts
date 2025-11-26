import { createServerFn } from '@tanstack/react-start'

const ELEVENLABS_API_BASE =
  process.env.ELEVENLABS_API_BASE ?? 'https://api.elevenlabs.io'
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID
const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_turbo_v2_5'

const MAX_TEXT_LENGTH = 4000

export interface TextToSpeechInput {
  text: string
  voiceId?: string
  modelId?: string
}

export interface TextToSpeechResult {
  audioDataUrl: string
  voiceId: string
  modelId: string
  bytes: number
}

function ensureEnv(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(
      `Missing ${key}. Set it in your environment to enable ElevenLabs TTS.`,
    )
  }
  return value
}

export const synthesizeSpeech = createServerFn({
  method: 'POST',
})
  .inputValidator((input: TextToSpeechInput) => {
    if (!input || typeof input.text !== 'string') {
      throw new Error('`text` is required for speech synthesis')
    }
    const trimmed = input.text.trim()
    if (trimmed.length === 0) {
      throw new Error('Text must not be empty')
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      throw new Error(
        `Text is too long (${trimmed.length} chars). Limit is ${MAX_TEXT_LENGTH}.`,
      )
    }
    return { ...input, text: trimmed }
  })
  .handler(async ({ data }): Promise<TextToSpeechResult> => {
    const apiKey = ensureEnv(ELEVENLABS_API_KEY, 'ELEVENLABS_API_KEY')
    const voiceId = 'SDNKIYEpTz0h56jQX8rA'
    if (!voiceId) {
      throw new Error(
        'No ElevenLabs voice configured. Provide ELEVENLABS_DEFAULT_VOICE_ID or pass `voiceId`.',
      )
    }
    const modelId = data.modelId ?? DEFAULT_MODEL_ID

    const payload = {
      text: data.text,
      model_id: modelId,
      output_format: 'mp3_44100_128',
    }

    const response = await fetch(
      `${ELEVENLABS_API_BASE}/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify(payload),
      },
    )

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        `ElevenLabs API error (${response.status} ${response.statusText}): ${errorBody}`,
      )
    }

    const buffer = await response.arrayBuffer()
    const audioDataUrl = `data:audio/mpeg;base64,${Buffer.from(buffer).toString('base64')}`

    return {
      audioDataUrl,
      voiceId,
      modelId,
      bytes: buffer.byteLength,
    }
  })

