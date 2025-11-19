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

let whisperPipeline: Pipeline | null = null
let faceApi: FaceApiType | null = null
let faceApiLoaded = false

async function loadWhisper() {
  if (whisperPipeline) return whisperPipeline

  console.log('Loading Whisper model...')
  const transformers = (await import('@xenova/transformers')) as TransformersType
  whisperPipeline = await transformers.pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
    device: 'webgpu',
  })
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

        // Convert audio blob to format expected by Whisper
        const audioContext = new AudioContext({ sampleRate: 16000 })
        const arrayBuffer = await audioBlob.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        // Get the first channel and convert to Float32Array
        const audioData = audioBuffer.getChannelData(0)
        
        // Resample if needed (Whisper expects 16kHz)
        let audioArray: Float32Array
        if (audioBuffer.sampleRate !== 16000) {
          const ratio = audioBuffer.sampleRate / 16000
          const newLength = Math.round(audioData.length / ratio)
          audioArray = new Float32Array(newLength)
          for (let i = 0; i < newLength; i++) {
            audioArray[i] = audioData[Math.round(i * ratio)]
          }
        } else {
          audioArray = audioData
        }

        const result = await pipeline(audioArray, {
          return_timestamps: false,
          language: null, // Auto-detect
        })

        const text = result.text || ''
        const language = result.language || 'en'

        return { text, language }
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
