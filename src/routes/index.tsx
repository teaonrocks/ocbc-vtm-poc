import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  PhoneCall,
  Play,
  Pause,
  RefreshCw,
  Volume2,
} from 'lucide-react'
import { useBankStore } from '../data/bank-store'
import { useLocalAI } from '../hooks/useLocalAI'
import { analyzeIntent } from '../functions/ai-intent'
import { AudioVisualizer } from '../components/Dashboard/AudioVisualizer'
import { ActionCards } from '../components/Dashboard/ActionCards'
import { synthesizeSpeech } from '../functions/tts'

type SpeechStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'error'

const START_PROMPT_TEXT =
  'welcome to OCBC, press start recording and make your request'
const FOLLOW_UP_PANEL_TEXT =
  'Is there anything else that the agent can help with?'
const FOLLOW_UP_VOICE_TEXT = 'Is there anything else I can help with?'
const FOLLOW_UP_DELAY_MS = 1200
const THANK_YOU_TEXT = 'Thank you for banking with OCBC.'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const {
    currentAction,
    language,
    languageSource,
    isRecording,
    isProcessing,
    setCurrentAction,
    setLanguage,
    setIsRecording,
    setIsProcessing,
    reset,
  } = useBankStore()

  const { transcribeAudio, isReady, error: aiError, modelInfo } = useLocalAI()
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const speechRequestIdRef = useRef(0)
  const lastSpeechKeyRef = useRef<string | null>(null)
  const lastActionKeyRef = useRef<string | null>(null)
  const followUpTimeoutRef = useRef<number | null>(null)
  const finishingSessionRef = useRef(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [lastSpeechText, setLastSpeechText] = useState<string | null>(null)
  const [lastSpeechSource, setLastSpeechSource] = useState<string | null>(null)
  const [clock, setClock] = useState<Date>(() => new Date())
  const [hasStarted, setHasStarted] = useState(false)
  const [hasCompletedIntent, setHasCompletedIntent] = useState(false)
  const [isFinishingSession, setIsFinishingSession] = useState(false)

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
          if (
            detectedLang &&
            detectedLang !== language &&
            languageSource === 'auto'
          ) {
            setLanguage(detectedLang, 'auto')
          }

          // Send to server function for intent analysis
          const intentResult = await analyzeIntent({
            data: { text, language: detectedLang ?? null },
          })

          setCurrentAction({
            intent: intentResult.intent,
            amount: intentResult.amount,
            recipient: intentResult.recipient,
            duration: intentResult.duration,
            spokenResponse: intentResult.responseText,
            transcript: text,
            translatedTranscript: intentResult.translatedText ?? text,
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
    languageSource,
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

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const stopSpeech = useCallback(() => {
    const audio = audioPlayerRef.current
    if (!audio) {
      return
    }
    audio.pause()
    audio.currentTime = 0
  }, [])

  const playSpeech = useCallback(
    async (source?: string) => {
      const audio = audioPlayerRef.current
      if (!audio) {
        throw new Error('Audio playback is unavailable in this browser.')
      }
      const resolvedSource = source ?? lastSpeechSource
      if (!resolvedSource) {
        throw new Error('No speech audio is ready yet.')
      }
      if (audio.src !== resolvedSource) {
        audio.src = resolvedSource
      }
      audio.currentTime = 0
      await audio.play()
    },
    [lastSpeechSource],
  )

  const runSpeechSynthesis = useCallback(
    async (text: string, requestId: number) => {
      setSpeechError(null)
      setSpeechStatus('loading')
      try {
        const speech = await synthesizeSpeech({ data: { text } })
        if (requestId !== speechRequestIdRef.current) {
          return
        }
        setLastSpeechSource(speech.audioDataUrl)
        setSpeechStatus('ready')

        try {
          await playSpeech(speech.audioDataUrl)
          if (requestId === speechRequestIdRef.current) {
            setSpeechStatus('playing')
          }
        } catch (playError) {
          if (requestId !== speechRequestIdRef.current) {
            return
          }
          setSpeechStatus('ready')
          setSpeechError(
            playError instanceof Error
              ? playError.message
              : 'Unable to auto-play voice. Tap Play Voice.',
          )
        }
      } catch (err) {
        if (requestId !== speechRequestIdRef.current) {
          return
        }
        setSpeechStatus('error')
        setSpeechError(
          err instanceof Error
            ? err.message
            : 'Failed to synthesize kiosk speech.',
        )
      }
    },
    [playSpeech],
  )

  const handlePlayVoice = useCallback(async () => {
    if (!voiceEnabled) {
      return
    }
    try {
      await playSpeech()
      setSpeechStatus('playing')
      setSpeechError(null)
    } catch (err) {
      setSpeechStatus(lastSpeechSource ? 'ready' : 'idle')
      setSpeechError(
        err instanceof Error
          ? err.message
          : 'Unable to play speech. Tap retry to regenerate audio.',
      )
    }
  }, [lastSpeechSource, playSpeech, voiceEnabled])

  const handleStopVoice = useCallback(() => {
    stopSpeech()
    setSpeechStatus(lastSpeechSource ? 'ready' : 'idle')
  }, [lastSpeechSource, stopSpeech])

  const handleRegenerateVoice = useCallback(() => {
    if (!lastSpeechText || !voiceEnabled) {
      return
    }
    const requestId = ++speechRequestIdRef.current
    runSpeechSynthesis(lastSpeechText, requestId)
  }, [lastSpeechText, runSpeechSynthesis, voiceEnabled])

  const handleGetStarted = useCallback(() => {
    if (hasStarted) {
      return
    }
    setHasStarted(true)
    setSpeechError(null)
    setLastSpeechText(START_PROMPT_TEXT)
    setLastSpeechSource(null)
    stopSpeech()
    const requestId = ++speechRequestIdRef.current
    if (!voiceEnabled) {
      setSpeechStatus('idle')
      return
    }
    runSpeechSynthesis(START_PROMPT_TEXT, requestId)
  }, [
    hasStarted,
    setHasStarted,
    setLastSpeechText,
    runSpeechSynthesis,
    setLastSpeechSource,
    stopSpeech,
    voiceEnabled,
    setSpeechStatus,
    setSpeechError,
  ])

  const cancelFollowUpTimeout = useCallback(() => {
    if (followUpTimeoutRef.current !== null) {
      window.clearTimeout(followUpTimeoutRef.current)
      followUpTimeoutRef.current = null
    }
  }, [])

  const scheduleFollowUpSpeech = useCallback(() => {
    const speakFollowUp = () => {
      followUpTimeoutRef.current = null
      stopSpeech()
      setLastSpeechText(FOLLOW_UP_VOICE_TEXT)
      setLastSpeechSource(null)
      setSpeechError(null)
      const requestId = ++speechRequestIdRef.current

      if (voiceEnabled) {
        runSpeechSynthesis(FOLLOW_UP_VOICE_TEXT, requestId)
      } else {
        setSpeechStatus('idle')
      }
    }

    cancelFollowUpTimeout()

    if (voiceEnabled) {
      followUpTimeoutRef.current = window.setTimeout(
        speakFollowUp,
        FOLLOW_UP_DELAY_MS,
      )
    } else {
      speakFollowUp()
    }
  }, [cancelFollowUpTimeout, runSpeechSynthesis, stopSpeech, voiceEnabled])

  const finalizeSessionReset = useCallback(() => {
    cancelFollowUpTimeout()
    finishingSessionRef.current = false
    setIsFinishingSession(false)
    stopSpeech()
    reset()
    setHasStarted(false)
    setHasCompletedIntent(false)
    lastActionKeyRef.current = null
    lastSpeechKeyRef.current = null
    speechRequestIdRef.current += 1
    setLastSpeechText(null)
    setLastSpeechSource(null)
    setSpeechError(null)
    setSpeechStatus('idle')
  }, [cancelFollowUpTimeout, reset, stopSpeech])

  const handleIntentCompleted = useCallback(() => {
    setHasCompletedIntent((alreadyCompleted) => {
      if (alreadyCompleted) {
        return alreadyCompleted
      }
      scheduleFollowUpSpeech()
      return true
    })
  }, [scheduleFollowUpSpeech])

  useEffect(() => {
    const spokenResponse = currentAction?.spokenResponse?.trim()
    const actionTimestamp = currentAction?.timestamp

    if (!spokenResponse || !actionTimestamp) {
      return
    }

    const responseKey = `${actionTimestamp}:${spokenResponse}`
    if (lastSpeechKeyRef.current === responseKey) {
      return
    }
    lastSpeechKeyRef.current = responseKey

    setLastSpeechText(spokenResponse)
    setLastSpeechSource(null)
    setSpeechError(null)

    const requestId = ++speechRequestIdRef.current

    if (!voiceEnabled) {
      setSpeechStatus('idle')
      return
    }

    stopSpeech()
    runSpeechSynthesis(spokenResponse, requestId)
  }, [
    currentAction?.spokenResponse,
    currentAction?.timestamp,
    runSpeechSynthesis,
    stopSpeech,
    voiceEnabled,
  ])

  useEffect(() => {
    if (voiceEnabled) {
      return
    }
    speechRequestIdRef.current += 1
    stopSpeech()
    setSpeechStatus('idle')
    setSpeechError(null)
  }, [stopSpeech, voiceEnabled])

  const handleSelectLanguage = useCallback(
    (code: string) => {
      setLanguage(code, 'manual')
    },
    [setLanguage],
  )

  const handleUseAutoLanguage = useCallback(() => {
    setLanguage(language, 'auto')
  }, [language, setLanguage])

  useEffect(() => {
    const audio = audioPlayerRef.current
    if (!audio) {
      return
    }

    const handleEnded = () => {
      setSpeechStatus('ready')
      if (finishingSessionRef.current) {
        finalizeSessionReset()
      }
    }
    const handlePause = () => setSpeechStatus('ready')
    const handlePlay = () => setSpeechStatus('playing')

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('play', handlePlay)

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('play', handlePlay)
    }
  }, [finalizeSessionReset])

  useEffect(() => {
    return () => {
      stopSpeech()
    }
  }, [stopSpeech])

  useEffect(() => {
    return () => {
      cancelFollowUpTimeout()
    }
  }, [cancelFollowUpTimeout])

  useEffect(() => {
    if (!currentAction) {
      lastActionKeyRef.current = null
      setHasCompletedIntent(false)
      return
    }

    const nextKey = `${currentAction.intent}:${currentAction.timestamp}`
    if (lastActionKeyRef.current !== nextKey) {
      lastActionKeyRef.current = nextKey
      setHasCompletedIntent(false)
    }
  }, [currentAction])

  const handleFinishSession = useCallback(() => {
    if (isFinishingSession) {
      return
    }

    cancelFollowUpTimeout()
    setIsFinishingSession(true)
    finishingSessionRef.current = true
    stopRecording()

    const thankYouText = THANK_YOU_TEXT
    setLastSpeechText(thankYouText)
    setLastSpeechSource(null)
    setSpeechError(null)
    const requestId = ++speechRequestIdRef.current

    if (voiceEnabled) {
      try {
        stopSpeech()
        runSpeechSynthesis(thankYouText, requestId).catch((err) => {
          console.error('Thank you speech error:', err)
          setSpeechStatus('error')
          setSpeechError(
            err instanceof Error
              ? err.message
              : 'Unable to play thank-you message.',
          )
          finalizeSessionReset()
        })
      } catch (err) {
        console.error('Thank you speech unexpected error:', err)
        finalizeSessionReset()
      }
    } else {
      finalizeSessionReset()
    }
  }, [
    cancelFollowUpTimeout,
    finalizeSessionReset,
    isFinishingSession,
    runSpeechSynthesis,
    stopRecording,
    stopSpeech,
    voiceEnabled,
  ])

  const formattedDate = clock.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const formattedTime = clock.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const actionDetectedAt = currentAction
    ? new Date(currentAction.timestamp).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  const modelStatusCopy: Record<typeof modelInfo.status, string> = {
    loading: 'Loading model…',
    ready: 'Ready',
    error: 'Unavailable',
  }
  const modelStatusBadgeColors: Record<typeof modelInfo.status, string> = {
    loading: 'bg-amber-500/15 text-amber-100',
    ready: 'bg-emerald-500/15 text-emerald-100',
    error: 'bg-rose-500/15 text-rose-100',
  }
  const whisperBackendCopy =
    modelInfo.backend === 'server'
      ? 'Remote faster-whisper service'
      : 'On-device WebGPU pipeline'

  const speechStatusCopy: Record<SpeechStatus, string> = {
    idle: voiceEnabled ? 'Voice idle' : 'Voice muted',
    loading: 'Generating audio',
    ready: 'Voice ready',
    playing: 'Speaking now',
    error: 'Voice unavailable',
  }

  const speechStatusIndicator = (() => {
    if (speechStatus === 'loading') {
      return <Loader2 className="h-3 w-3 animate-spin text-amber-200" />
    }
    if (speechStatus === 'error') {
      return <AlertCircle className="h-3 w-3 text-rose-200" />
    }
    if (speechStatus === 'playing') {
      return <Volume2 className="h-3 w-3 text-emerald-200" />
    }
    if (!voiceEnabled) {
      return <Volume2 className="h-3 w-3 text-slate-500" />
    }
    return <Volume2 className="h-3 w-3 text-cyan-200" />
  })()

  const languageOptions = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: 'Chinese' },
    { code: 'ms', label: 'Malay' },
    { code: 'ta', label: 'Tamil' },
  ]

  const hasSpeechAudio = Boolean(lastSpeechSource)
  const playButtonDisabled =
    !voiceEnabled ||
    speechStatus === 'loading' ||
    (!hasSpeechAudio && speechStatus !== 'playing')

  const regenerateDisabled =
    !voiceEnabled || !lastSpeechText || speechStatus === 'loading'

  const voicePrompts = [
    { title: 'Remittance', sample: '"Send $1000 to John Doe"' },
    { title: 'Loan', sample: '"Apply for $5000 loan for 12 months"' },
    { title: 'Card App', sample: '"Apply for a new card"' },
    { title: 'Update Book', sample: '"Update my bank book"' },
    { title: 'Card Replace', sample: '"Replace my card"' },
  ]

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <audio ref={audioPlayerRef} className="hidden" aria-hidden="true" />
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center space-y-6 px-4 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
            OCBC Virtual Teller
          </p>
          <h1 className="text-4xl font-semibold">Smart Banking Kiosk</h1>
          <p className="text-slate-400">Voice-powered banking with local AI.</p>
          <button
            type="button"
            onClick={handleGetStarted}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-8 py-3 text-lg font-semibold text-white transition hover:bg-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            Get started
          </button>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            {formattedDate} · {formattedTime}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <audio ref={audioPlayerRef} className="hidden" aria-hidden="true" />
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">
            OCBC Virtual Teller
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Smart Banking Kiosk</h1>
              <p className="text-slate-400">
                Voice-powered banking with local AI.
              </p>
            </div>
            <div className="text-right text-sm text-slate-400">
              <p>{formattedDate}</p>
              <p className="text-2xl font-semibold text-white">
                {formattedTime}
              </p>
            </div>
          </div>
        </header>

        <section className="space-y-6">
          <div className="space-y-6">
            <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                    Voice input
                  </p>
                  <h2 className="text-2xl font-semibold text-white">
                    Hands-free banking
                  </h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${isRecording ? 'bg-red-500/20 text-red-200' : 'bg-slate-800 text-slate-300'}`}
                >
                  {isRecording ? 'Recording' : 'Idle'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="tracking-[0.35em] text-[0.6rem] uppercase text-slate-500">
                    Language
                  </span>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-[0.65rem] font-semibold text-white">
                    {language.toUpperCase()} ·{' '}
                    {languageSource === 'manual' ? 'Manual' : 'Auto'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {languageOptions.map((option) => {
                    const isSelected =
                      language === option.code && languageSource === 'manual'
                    return (
                      <button
                        key={option.code}
                        type="button"
                        onClick={() => handleSelectLanguage(option.code)}
                        className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold transition ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/60'
                            : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={handleUseAutoLanguage}
                    className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold transition ${
                      languageSource === 'auto'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/60'
                        : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    Auto detect
                  </button>
                </div>
              </div>

              <AudioVisualizer
                audioStream={audioStreamRef.current || null}
                isRecording={isRecording}
              />

              <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                      Whisper backend
                    </p>
                    <p className="text-base font-semibold text-white">
                      {modelInfo.name ?? 'Detecting…'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {whisperBackendCopy}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${modelStatusBadgeColors[modelInfo.status]}`}
                  >
                    {modelStatusCopy[modelInfo.status]}
                  </span>
                </div>
                {modelInfo.error && (
                  <p className="mt-2 text-xs text-rose-200">
                    {modelInfo.error}
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}
              {aiError && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  AI Error: {aiError}
                </div>
              )}

              {isProcessing ? (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing your last command...
                </div>
              ) : (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={!isReady}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-500 disabled:border-slate-800 disabled:text-slate-500"
                >
                  {isRecording ? (
                    <>
                      <MicOff size={18} />
                      Stop recording
                    </>
                  ) : (
                    <>
                      <Mic size={18} />
                      Start recording
                    </>
                  )}
                </button>
              )}

              <p className="text-sm text-slate-500">
                {isRecording
                  ? 'Speak your request clearly. We stop listening as soon as you tap stop.'
                  : 'Press start and say what you need—no menus required.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                    Kiosk voice
                  </p>
                  <h3 className="text-xl font-semibold text-white">
                    Spoken guidance
                  </h3>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-cyan-500"
                    checked={voiceEnabled}
                    onChange={(event) => setVoiceEnabled(event.target.checked)}
                  />
                  {voiceEnabled ? 'Voice on' : 'Muted'}
                </label>
              </div>

              <p className="text-sm text-slate-400 min-h-12">
                {lastSpeechText ?? 'No AI response yet.'}
              </p>

              <div className="flex flex-wrap gap-3 text-sm">
                <button
                  onClick={
                    speechStatus === 'playing'
                      ? handleStopVoice
                      : handlePlayVoice
                  }
                  disabled={playButtonDisabled}
                  className="inline-flex flex-1 min-w-36 items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2 font-semibold text-white transition hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                >
                  {speechStatus === 'playing' ? (
                    <>
                      <Pause size={16} />
                      Pause voice
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Play voice
                    </>
                  )}
                </button>
                <button
                  onClick={handleRegenerateVoice}
                  disabled={regenerateDisabled}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2 font-semibold text-white transition hover:border-slate-500 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                >
                  <RefreshCw size={16} />
                  Refresh audio
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                {speechStatusIndicator}
                <span>{speechStatusCopy[speechStatus]}</span>
              </div>

              {speechError && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  {speechError}
                </div>
              )}
            </div>

            {currentAction ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
                <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-slate-500">
                  <span>Detected intent</span>
                  {actionDetectedAt && <span>{actionDetectedAt}</span>}
                </div>
                {currentAction.spokenResponse && (
                  <p className="mb-4 text-sm text-slate-400">
                    {currentAction.spokenResponse}
                  </p>
                )}
                <ActionCards
                  action={currentAction}
                  onIntentCompleted={handleIntentCompleted}
                />
                {currentAction.transcript && (
                  <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-3">
                      Transcript debug
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
                          Original
                        </p>
                        <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">
                          {currentAction.transcript}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">
                          Translated
                        </p>
                        <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">
                          {currentAction.translatedTranscript ??
                            currentAction.transcript}
                        </p>
                        {currentAction.translatedTranscript ===
                          currentAction.transcript && (
                          <p className="mt-1 text-xs text-slate-500">
                            Same as original
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {hasCompletedIntent && (
                  <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/40 p-5">
                    <p className="text-sm text-slate-200">
                      {FOLLOW_UP_PANEL_TEXT}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleFinishSession}
                        disabled={isFinishingSession}
                        className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400"
                      >
                        {isFinishingSession ? 'Finishing…' : 'Finish session'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-center">
                <p className="text-sm text-slate-400">
                  No request captured yet. Start recording to describe what you
                  need help with.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                Voice prompts
              </p>
              <h3 className="text-xl font-semibold text-white">
                Try a ready-made phrase
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Speak in {language.toUpperCase()} or let us detect automatically.
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {voicePrompts.map((prompt) => (
              <div
                key={prompt.title}
                className="rounded-lg border border-slate-800 bg-slate-900/30 p-4"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {prompt.title}
                </p>
                <p className="mt-2 text-sm text-white">{prompt.sample}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
          <p className="text-sm text-slate-400">
            Need extra help? Connect with a specialist in seconds.
          </p>
          <Link
            to={'/live-agent' as any}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-500"
          >
            <PhoneCall size={18} />
            Request live agent
          </Link>
          <p className="mt-2 text-xs text-slate-500">
            We’ll guide you to the live agent screen.
          </p>
        </section>
      </div>
    </div>
  )
}
