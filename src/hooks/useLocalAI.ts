import { useCallback, useEffect, useRef, useState } from 'react'
import { Pipeline } from '@xenova/transformers'

interface TranscriptionResult {
  text: string
  language: string
}

interface FaceVerificationResult {
  verified: boolean
  confidence?: number
}

// Dynamic import types
type FaceApiType = typeof import('@vladmandic/face-api')
type TransformersType = typeof import('@xenova/transformers')

const TARGET_SAMPLE_RATE = 16000
const CJK_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/
const ASCII_LETTER_REGEX = /[a-z]/i
const MALAY_LANGUAGE_CODES = new Set(['ms', 'msa', 'zsm'])
const MALAY_KEYWORDS = [
  'akaun',
  'pemindahan',
  'memindahkan',
  'wang',
  'nombor',
  'jumlah',
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
]

let whisperPipeline: Pipeline | null = null
let faceApi: FaceApiType | null = null
let faceApiLoaded = false

function normalizeLanguageCode(code?: string | null): string | null {
  if (!code) return null
  const normalized = code.toLowerCase()
  if (normalized === 'english') return 'en'
  if (normalized === 'chinese' || normalized === 'cmn') return 'zh'
  if (MALAY_LANGUAGE_CODES.has(normalized) || normalized === 'malay') return 'ms'
  return normalized
}

function inferLanguageFromText(text: string): string | null {
  if (!text) return null
  if (CJK_REGEX.test(text)) return 'zh'
  const lower = text.toLowerCase()
  if (MALAY_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return 'ms'
  }
  if (ASCII_LETTER_REGEX.test(text)) {
    return 'en'
  }
  return null
}

function parseWhisperOutput(result: unknown): { text: string; language: string | null } {
  if (!result) {
    return { text: '', language: null }
  }

  if (typeof result === 'string') {
    return { text: result, language: null }
  }

  if (Array.isArray(result)) {
    const firstEntry = result[0] as Record<string, unknown> | undefined
    const text = (firstEntry?.text as string) || ''
    const language = normalizeLanguageCode(firstEntry?.language as string | null)
    return { text, language }
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>
    const text =
      (obj.text as string) ||
      (obj.transcription as string) ||
      (Array.isArray(obj.chunks) && (obj.chunks[0] as Record<string, unknown>)?.text) ||
      ''

    let language =
      normalizeLanguageCode(obj.language as string | null) ||
      normalizeLanguageCode(obj.language_id as string | null) ||
      normalizeLanguageCode(obj.language_code as string | null) ||
      normalizeLanguageCode(obj.lang as string | null) ||
      null

    if (!language && Array.isArray(obj.chunks)) {
      const chunkWithLanguage = obj.chunks.find(
        (chunk) => typeof chunk === 'object' && chunk !== null && 'language' in chunk,
      ) as Record<string, unknown> | undefined
      if (chunkWithLanguage) {
        language = normalizeLanguageCode(chunkWithLanguage.language as string | null)
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

async function runWhisperTranscription(
  pipeline: Pipeline,
  audioArray: Float32Array,
  languageOverride: string | null,
) {
  const result = await pipeline(audioArray, {
    return_timestamps: false,
    language: languageOverride,
    task: 'transcribe',
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
  const transformers = (await import('@xenova/transformers')) as TransformersType
  const pipelineInstance = (await transformers.pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-small',
    {
      device: 'webgpu',
    },
  )) as Pipeline

  const pipelineWithInternals = pipelineInstance as Pipeline & {
    tokenizer?: {
      _decode_asr: (...args: any[]) => unknown
      __languagePatched?: boolean
    }
  }

  if (pipelineWithInternals.tokenizer && !pipelineWithInternals.tokenizer.__languagePatched) {
    const originalDecode = pipelineWithInternals.tokenizer._decode_asr.bind(
      pipelineWithInternals.tokenizer,
    )
    pipelineWithInternals.tokenizer._decode_asr = (chunks: unknown, options: Record<string, unknown> = {}) =>
      originalDecode(chunks, { ...options, return_language: true })
    pipelineWithInternals.tokenizer.__languagePatched = true
  }

  whisperPipeline = pipelineWithInternals
  console.log('Whisper model loaded')
  return whisperPipeline
}

async function loadFaceAPI() {
  if (faceApiLoaded && faceApi) return faceApi

  console.log('Loading Face API models...')
  // Dynamic import to avoid SSR issues
  faceApi = (await import('@vladmandic/face-api')) as FaceApiType
  const MODEL_URL = '/models'

  await Promise.all([
    faceApi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceApi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceApi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])

  faceApiLoaded = true
  console.log('Face API models loaded')
  return faceApi
}

export function useLocalAI() {
  const [isWhisperReady, setIsWhisperReady] = useState(false)
  const [isFaceAPIReady, setIsFaceAPIReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isInitializing = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isInitializing.current) return

    isInitializing.current = true

    // Load Whisper
    loadWhisper()
      .then(() => setIsWhisperReady(true))
      .catch((err) => {
        console.error('Failed to load Whisper:', err)
        setError(`Failed to load Whisper: ${err.message}`)
      })

    // Load Face API
    loadFaceAPI()
      .then(() => setIsFaceAPIReady(true))
      .catch((err) => {
        console.error('Failed to load Face API:', err)
        setError(`Failed to load Face API: ${err.message}`)
      })
  }, [])

  const transcribeAudio = useCallback(
    async (audioBlob: Blob): Promise<TranscriptionResult> => {
      if (!isWhisperReady) {
        throw new Error('Whisper model not ready')
      }

      try {
        const pipeline = await loadWhisper()
        if (!pipeline) throw new Error('Pipeline failed to load')

        const audioArray = await audioBlobToFloat32(audioBlob)
        const initialRun = await runWhisperTranscription(pipeline, audioArray, null)

        let finalText = initialRun.text
        let finalLanguage = initialRun.language || inferLanguageFromText(initialRun.text) || 'unknown'

        // Whisper occasionally misclassifies English audio as Malay ("ms").
        if (finalLanguage === 'ms') {
          const englishRetry = await runWhisperTranscription(pipeline, audioArray, 'en')
          if (englishRetry.text) {
            finalText = englishRetry.text
            finalLanguage = englishRetry.language || 'en'
          }
        } else if (!finalLanguage || finalLanguage === 'unknown') {
          // Fallback to English transcription if language detection was inconclusive.
          const englishRetry = await runWhisperTranscription(pipeline, audioArray, 'en')
          if (englishRetry.text.trim().length > 0) {
            finalText = englishRetry.text
            finalLanguage = englishRetry.language || inferLanguageFromText(englishRetry.text) || 'en'
          } else if (CJK_REGEX.test(initialRun.text)) {
            finalLanguage = 'zh'
          }
        }

        if (!finalLanguage || finalLanguage === 'unknown') {
          finalLanguage = inferLanguageFromText(finalText) || 'unknown'
        }

        return { text: finalText, language: finalLanguage }
      } catch (err) {
        console.error('Transcription error:', err)
        throw new Error(`Transcription failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    },
    [isWhisperReady]
  )

  const verifyFace = useCallback(
    async (videoElement: HTMLVideoElement): Promise<FaceVerificationResult> => {
      if (!isFaceAPIReady || !faceApi) {
        throw new Error('Face API not ready')
      }

      try {
        const detections = await faceApi
          .detectSingleFace(videoElement, new faceApi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor()

        if (!detections) {
          return { verified: false, confidence: 0 }
        }

        // For POC: Mock verification - in production, compare with stored descriptor
        // Here we just check if a face is detected with reasonable confidence
        const confidence = detections.detection.score || 0
        const verified = confidence > 0.5

        return { verified, confidence }
      } catch (err) {
        console.error('Face verification error:', err)
        return { verified: false, confidence: 0 }
      }
    },
    [isFaceAPIReady]
  )

  return {
    isWhisperReady,
    isFaceAPIReady,
    isReady: isWhisperReady && isFaceAPIReady,
    error,
    transcribeAudio,
    verifyFace,
  }
}
