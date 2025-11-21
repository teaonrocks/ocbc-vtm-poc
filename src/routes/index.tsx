import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Globe, Loader2, Mic, MicOff } from 'lucide-react'
import { useBankStore } from '../data/bank-store'
import { useLocalAI } from '../hooks/useLocalAI'
import { analyzeIntent } from '../functions/ai-intent'
import { AudioVisualizer } from '../components/Dashboard/AudioVisualizer'
import { ActionCards } from '../components/Dashboard/ActionCards'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const {
    currentAction,
    language,
    isRecording,
    isProcessing,
    setCurrentAction,
    setLanguage,
    setIsRecording,
    setIsProcessing,
    balance,
    transactions,
  } = useBankStore()

  const { transcribeAudio, isReady, error: aiError } = useLocalAI()
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream

      const chunks: Array<Blob> = []
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
          const { text, language: detectedLang } =
            await transcribeAudio(audioBlob)

          // Update language if detected
          if (detectedLang && detectedLang !== language) {
            setLanguage(detectedLang)
          }

          // Send to server function for intent analysis
          const intentResult = await analyzeIntent({ data: { text } })

          setCurrentAction({
            intent: intentResult.intent,
            amount: intentResult.amount,
            recipient: intentResult.recipient,
            duration: intentResult.duration,
            timestamp: Date.now(),
          })
        } catch (err) {
          console.error('Processing error:', err)
          setError(
            err instanceof Error ? err.message : 'Failed to process audio',
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
  }, [
    transcribeAudio,
    language,
    setLanguage,
    setIsRecording,
    setIsProcessing,
    setCurrentAction,
  ])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [isRecording, setIsRecording])

  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2">
            <span className="bg-linear-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Smart Banking Kiosk
            </span>
          </h1>
          <p className="text-gray-400 text-lg">
            Voice-powered banking with local AI
          </p>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${isReady ? 'bg-green-400' : 'bg-red-400'}`}
              />
              <span className="text-gray-400 text-sm">
                AI {isReady ? 'Ready' : 'Loading...'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="text-gray-400" size={16} />
              <span className="text-gray-400 text-sm">
                Language: {language.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="text-white font-semibold text-xl">
            Balance: ${balance.toLocaleString()}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Audio Input */}
          <div className="lg:col-span-2 space-y-6">
            {/* Audio Visualizer */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">
                Voice Input
              </h2>
              <AudioVisualizer
                audioStream={audioStreamRef.current || null}
                isRecording={isRecording}
              />
            </div>

            {/* Recording Controls */}
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              {aiError && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                  AI Error: {aiError}
                </div>
              )}

              {isProcessing ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="text-cyan-400 animate-spin" size={48} />
                  <p className="text-gray-400">Processing your request...</p>
                </div>
              ) : (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={!isReady}
                  className={`mx-auto flex items-center gap-3 px-8 py-4 rounded-full text-white font-semibold text-lg transition-all ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <MicOff size={24} />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic size={24} />
                      Start Recording
                    </>
                  )}
                </button>
              )}

              <p className="text-gray-500 text-sm mt-4">
                {isRecording
                  ? 'Speak your banking request now...'
                  : 'Press the button and speak your banking request'}
              </p>
            </div>

            {/* Action Display */}
            {currentAction && (
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <ActionCards action={currentAction} />
              </div>
            )}
          </div>

          {/* Right Column - Account Info */}
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">
                Account Summary
              </h2>
              <div className="space-y-3">
                <div>
                  <div className="text-gray-400 text-sm">Available Balance</div>
                  <div className="text-white text-2xl font-bold">
                    ${balance.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">
                    Recent Transactions
                  </div>
                  <div className="text-white text-lg">
                    {transactions.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">
                Recent Transactions
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {transactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center p-2 bg-slate-900/50 rounded"
                  >
                    <div>
                      <div className="text-white text-sm">{tx.description}</div>
                      <div className="text-gray-500 text-xs">
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    <div
                      className={`font-semibold ${tx.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}$
                      {tx.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-3">
            Voice Commands
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-cyan-400 font-semibold mb-1">Remittance</div>
              <div className="text-gray-400">"Send $1000 to John Doe"</div>
            </div>
            <div>
              <div className="text-blue-400 font-semibold mb-1">Loan</div>
              <div className="text-gray-400">
                "Apply for $5000 loan for 12 months"
              </div>
            </div>
            <div>
              <div className="text-green-400 font-semibold mb-1">Card App</div>
              <div className="text-gray-400">"Apply for a new card"</div>
            </div>
            <div>
              <div className="text-purple-400 font-semibold mb-1">
                Update Book
              </div>
              <div className="text-gray-400">"Update my bank book"</div>
            </div>
            <div>
              <div className="text-red-400 font-semibold mb-1">
                Card Replace
              </div>
              <div className="text-gray-400">"Replace my card"</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
