import { useCallback, useEffect, useRef, useState } from 'react'
import type { Pipeline } from '@xenova/transformers'

interface TranscriptionResult {
  text: string
  language: string
  backend: 'server' | 'webgpu'
  latency?: number
}

async function importTransformersModule() {
  return import('@xenova/transformers')
}

type TransformersModule = Awaited<ReturnType<typeof importTransformersModule>>
type TokenizerWithAsr = {
  _decode_asr: (...args: Array<unknown>) => unknown
  __languagePatched?: boolean
}

const TARGET_SAMPLE_RATE = 16000
const CJK_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/
const TAMIL_REGEX = /[\u0B80-\u0BFF]/
const ASCII_LETTER_REGEX = /[a-z]/i
const MALAY_LANGUAGE_CODES = new Set(['ms', 'msa', 'zsm'])
const MALAY_KEYWORDS = [
  'akaun',
  'akaun simpanan',
  'akaun semasa',
  'akaun kredit',
  'akaun debit',
  'bank',
  'pindahan',
  'pemindahan',
  'pindahkan',
  'memindahkan',
  'transfer',
  'wang',
  'duit',
  'tunai',
  'nombor',
  'jumlah',
  'baki',
  'semak',
  'bayaran',
  'pembayaran',
  'penghantaran',
  'pengeluaran',
  'deposit',
  'pinjaman',
  'kadar',
  'faedah',
  'sila',
  'terima kasih',
  'tolong',
  'daripada',
  'kepada',
  'perlu',
  'anda',
  'butiran',
  'cawangan',
  'pengesahan',
  'kemas kini',
  'kad',
  'pelanggan',
  'rujukan',
  'perbankan',
  'kewangan',
]

let whisperPipeline: Pipeline | null = null

function normalizeLanguageCode(code?: string | null): string | null {
  if (!code) return null
  const normalized = code.toLowerCase()
  if (normalized === 'english') return 'en'
  if (normalized === 'chinese' || normalized === 'cmn') return 'zh'
  if (normalized === 'tamil') return 'ta'
  if (MALAY_LANGUAGE_CODES.has(normalized) || normalized === 'malay')
    return 'ms'
  return normalized
}

function inferLanguageFromText(text: string): string | null {
  if (!text) return null
  if (CJK_REGEX.test(text)) return 'zh'
  if (TAMIL_REGEX.test(text)) return 'ta'
  const lower = text.toLowerCase()
  if (MALAY_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return 'ms'
  }
  if (ASCII_LETTER_REGEX.test(text)) {
    return 'en'
  }
  return null
}

function looksEnglish(text: string): boolean {
  if (!text) return false
  if (CJK_REGEX.test(text) || TAMIL_REGEX.test(text)) return false

  const clean = text.replace(/[^a-zA-Z\s]/g, '')
  const letterRatio = clean.length / Math.max(text.length, 1)
  if (letterRatio < 0.6) return false

  const lower = text.toLowerCase()
  if (MALAY_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return false
  }

  return true
}

function parseWhisperOutput(result: unknown): {
  text: string
  language: string | null
} {
  if (!result) {
    return { text: '', language: null }
  }

  if (typeof result === 'string') {
    return { text: result, language: null }
  }

  if (Array.isArray(result)) {
    const firstEntry = result[0] as Record<string, unknown> | undefined
    const text = (firstEntry?.text as string) || ''
    const language = normalizeLanguageCode(
      firstEntry?.language as string | null,
    )
    return { text, language }
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>

    let chunkText: string | undefined
    if (Array.isArray(obj.chunks) && obj.chunks[0]) {
      const firstChunk = obj.chunks[0] as Record<string, unknown>
      const candidate = firstChunk.text
      if (typeof candidate === 'string') {
        chunkText = candidate
      }
    }

    const text =
      (obj.text as string | undefined) ??
      (obj.transcription as string | undefined) ??
      chunkText ??
      ''

    let language =
      normalizeLanguageCode(obj.language as string | null) ||
      normalizeLanguageCode(obj.language_id as string | null) ||
      normalizeLanguageCode(obj.language_code as string | null) ||
      normalizeLanguageCode(obj.lang as string | null) ||
      null

    if (!language && Array.isArray(obj.chunks)) {
      const chunkWithLanguage = obj.chunks.find(
        (chunk) =>
          typeof chunk === 'object' && chunk !== null && 'language' in chunk,
      ) as Record<string, unknown> | undefined
      if (chunkWithLanguage) {
        language = normalizeLanguageCode(
          chunkWithLanguage.language as string | null,
        )
      }
    }

    return { text, language }
  }

  return { text: '', language: null }
}

async function audioBlobToFloat32(audioBlob: Blob): Promise<Float32Array> {
  const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
  const arrayBuffer = await audioBlob.arrayBuffer()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  const audioData = audioBuffer.getChannelData(0)

  if (audioBuffer.sampleRate === TARGET_SAMPLE_RATE) {
    return audioData
  }

  const ratio = audioBuffer.sampleRate / TARGET_SAMPLE_RATE
  const newLength = Math.round(audioData.length / ratio)
  const resampled = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    resampled[i] = audioData[Math.round(i * ratio)]
  }
  return resampled
}

type WhisperTask = 'transcribe' | 'translate'

async function runWhisperTranscription(
  pipeline: Pipeline,
  audioArray: Float32Array,
  options?: {
    languageOverride?: string | null
    task?: WhisperTask
  },
) {
  const { languageOverride = null, task = 'transcribe' } = options ?? {}

  const result = await pipeline(audioArray, {
    return_timestamps: false,
    language: languageOverride,
    task,
  })

  const parsed = parseWhisperOutput(result)
  return {
    text: parsed.text,
    language:
      normalizeLanguageCode(parsed.language) ||
      normalizeLanguageCode(languageOverride) ||
      inferLanguageFromText(parsed.text),
  }
}

async function loadWhisper() {
  if (whisperPipeline) return whisperPipeline

  console.log('Loading Whisper model...')
  const transformers: TransformersModule = await importTransformersModule()
  const pipelineInstance = (await transformers.pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-small',
    {
      device: 'webgpu',
    } as Record<string, unknown>,
  )) as Pipeline

  const tokenizer = (
    pipelineInstance as unknown as { tokenizer?: TokenizerWithAsr }
  ).tokenizer

  if (tokenizer && !tokenizer.__languagePatched) {
    const originalDecode = tokenizer._decode_asr.bind(tokenizer)
    tokenizer._decode_asr = (...args: Array<unknown>) => {
      const [chunks, maybeOptions] = args as [unknown, Record<string, unknown>?]
      const options = maybeOptions ?? {}
      return originalDecode(chunks, { ...options, return_language: true })
    }
    tokenizer.__languagePatched = true
  }

  whisperPipeline = pipelineInstance
  console.log('Whisper model loaded')
  return whisperPipeline
}

async function transcribeWithServer(
  audioBlob: Blob,
  serverUrl: string,
): Promise<TranscriptionResult> {
  const formData = new FormData()
  formData.append('file', audioBlob)
  formData.append('task', 'translate')
  // formData.append('beam_size', '5')

  const start = Date.now()
  const response = await fetch(`${serverUrl}/transcribe`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Server error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    text: data.text,
    language: data.language || 'unknown',
    backend: 'server',
    latency: Date.now() - start,
  }
}

export function useLocalAI() {
  const [isWhisperReady, setIsWhisperReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isInitializing = useRef(false)

  const serverUrl = import.meta.env.VITE_FASTER_WHISPER_URL

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isInitializing.current) return

    isInitializing.current = true

    // Load Whisper only if server URL is not present
    if (!serverUrl) {
      loadWhisper()
        .then(() => setIsWhisperReady(true))
        .catch((err) => {
          console.error('Failed to load Whisper:', err)
          setError(`Failed to load Whisper: ${err.message}`)
        })
    } else {
      // Assume server is ready if URL is provided (or check health)
      setIsWhisperReady(true)
    }
  }, [serverUrl])

  const transcribeAudio = useCallback(
    async (audioBlob: Blob): Promise<TranscriptionResult> => {
      if (!isWhisperReady) {
        throw new Error('Whisper model not ready')
      }

      if (serverUrl) {
        try {
          return await transcribeWithServer(audioBlob, serverUrl)
        } catch (err) {
          console.error(
            'Server transcription failed, falling back to local:',
            err,
          )
          // Fallback to local if server fails?
          // For now, just throw to match plan "bypass local pipeline"
          // But if we want fallback, we'd need to ensure local model is loaded.
          throw err
        }
      }

      try {
        const pipeline = await loadWhisper()

        const audioArray = await audioBlobToFloat32(audioBlob)
        const start = Date.now()
        const baseline = await runWhisperTranscription(pipeline, audioArray)

        let detectedLanguage =
          baseline.language || inferLanguageFromText(baseline.text) || 'unknown'

        if (detectedLanguage === 'ms' && looksEnglish(baseline.text)) {
          detectedLanguage = 'en'
        }

        let finalLanguage = detectedLanguage
        if (!finalLanguage || finalLanguage === 'unknown') {
          finalLanguage = inferLanguageFromText(baseline.text) || 'unknown'
        }

        let finalText = baseline.text
        const needsEnglishTranslation = finalLanguage !== 'en'

        if (needsEnglishTranslation) {
          const languageOverride =
            finalLanguage === 'unknown'
              ? null
              : (finalLanguage as string | null)
          const translation = await runWhisperTranscription(
            pipeline,
            audioArray,
            {
              languageOverride,
              task: 'translate',
            },
          )

          if (translation.text.trim().length > 0) {
            finalText = translation.text
          }
        }

        if (!finalText.trim()) {
          // As a safety net, try an English pass
          const englishRetry = await runWhisperTranscription(
            pipeline,
            audioArray,
            {
              languageOverride: 'en',
              task: 'transcribe',
            },
          )
          if (englishRetry.text.trim()) {
            finalText = englishRetry.text
            if (!finalLanguage || finalLanguage === 'unknown') {
              finalLanguage = englishRetry.language || 'en'
            }
          }
        }

        return {
          text: finalText,
          language: finalLanguage,
          backend: 'webgpu',
          latency: Date.now() - start,
        }
      } catch (err) {
        console.error('Transcription error:', err)
        throw new Error(
          `Transcription failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        )
      }
    },
    [isWhisperReady, serverUrl],
  )

  return {
    isWhisperReady,
    isReady: isWhisperReady,
    error,
    transcribeAudio,
  }
}
