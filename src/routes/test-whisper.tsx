import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { useLocalAI } from '../hooks/useLocalAI'

export const Route = createFileRoute('/test-whisper')({
  component: WhisperTest,
})

function WhisperTest() {
  const { transcribeAudio, isWhisperReady, error: aiError } = useLocalAI()
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcription, setTranscription] = useState<string | null>(null)
  const [language, setLanguage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      setTranscription(null)
      setLanguage(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream

      const chunks: Blob[] = []
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop())
          audioStreamRef.current = null
        }

        if (chunks.length === 0) {
          setError('No audio recorded')
          setIsRecording(false)
          return
        }

        setIsProcessing(true)
        try {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' })
          const { text, language } = await transcribeAudio(audioBlob)
          setTranscription(text)
          setLanguage(language)
        } catch (err) {
          console.error('Transcription error:', err)
          setError(
            err instanceof Error ? err.message : 'Failed to transcribe audio',
          )
        } finally {
          setIsProcessing(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Recording error:', err)
      setError('Failed to access microphone')
      setIsRecording(false)
    }
  }, [transcribeAudio])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording])

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Whisper Model Test</h1>

      {/* Status Section */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Status</h2>
        <div className="space-y-1">
          <div>
            <span className="font-medium">Model:</span>{' '}
            {isWhisperReady ? (
              <span className="text-green-600">Ready</span>
            ) : (
              <span className="text-yellow-600">Loading...</span>
            )}
          </div>
          <div>
            <span className="font-medium">Recording:</span>{' '}
            {isRecording ? (
              <span className="text-red-600">Active</span>
            ) : (
              <span className="text-gray-600">Stopped</span>
            )}
          </div>
          {isProcessing && (
            <div>
              <span className="font-medium">Processing:</span>{' '}
              <span className="text-blue-600">Transcribing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(error || aiError) && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <p className="font-semibold">Error:</p>
          <p>{error || aiError}</p>
        </div>
      )}

      {/* Recording Button */}
      <div className="mb-6 flex justify-center">
        <button
          onClick={handleToggleRecording}
          disabled={!isWhisperReady || isProcessing}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : isRecording ? (
            <>
              <MicOff className="w-5 h-5" />
              <span>Stop Recording</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>Start Recording</span>
            </>
          )}
        </button>
      </div>

      {/* Transcription Display */}
      {transcription && (
        <div className="mt-6 p-4 bg-white border border-gray-300 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Transcription</h2>
            {language && (
              <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                Language: <span className="font-mono font-semibold">{language}</span>
              </span>
            )}
          </div>
          <p className="text-gray-800 whitespace-pre-wrap">{transcription}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Instructions</h2>
        <ol className="list-decimal list-inside space-y-1 text-gray-700">
          <li>Wait for the model to load (status will show "Ready")</li>
          <li>Click "Start Recording" to begin recording audio</li>
          <li>Speak into your microphone</li>
          <li>Click "Stop Recording" when finished</li>
          <li>The transcribed text will appear below</li>
        </ol>
      </div>
    </div>
  )
}

