import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useLocalAI } from '../../hooks/useLocalAI'

interface FaceVerificationProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
}

export function FaceVerification({ isOpen, onClose, onVerified }: FaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'scanning' | 'verified' | 'failed'>('scanning')
  const [message, setMessage] = useState('Please look at the camera')
  const { verifyFace, isFaceAPIReady } = useLocalAI()
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!isOpen || !isFaceAPIReady) return

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
        }

        // Start verification attempts
        intervalRef.current = setInterval(async () => {
          if (videoRef.current && status === 'scanning') {
            try {
              const result = await verifyFace(videoRef.current)
              if (result.verified) {
                setStatus('verified')
                setMessage('Face verified successfully!')
                clearInterval(intervalRef.current)
                setTimeout(() => {
                  onVerified()
                  onClose()
                }, 1500)
              }
            } catch (error) {
              console.error('Verification error:', error)
            }
          }
        }, 1000)
      } catch (error) {
        console.error('Camera error:', error)
        setStatus('failed')
        setMessage('Failed to access camera')
      }
    }

    startCamera()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isOpen, isFaceAPIReady, verifyFace, status, onVerified, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative bg-slate-900 rounded-xl p-8 max-w-md w-full mx-4 border border-cyan-500/30 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Face Verification</h2>
          <p className="text-gray-400">Required for high-value transactions</p>
        </div>

        <div className="relative mb-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-lg bg-black"
            style={{ transform: 'scaleX(-1)' }}
          />
          {status === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-pulse text-cyan-400 text-lg font-semibold">
                Scanning...
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
          {status === 'verified' && (
            <>
              <CheckCircle2 className="text-green-400" size={24} />
              <p className="text-green-400 font-semibold">{message}</p>
            </>
          )}
          {status === 'failed' && (
            <>
              <AlertCircle className="text-red-400" size={24} />
              <p className="text-red-400 font-semibold">{message}</p>
            </>
          )}
          {status === 'scanning' && (
            <p className="text-cyan-400 font-semibold">{message}</p>
          )}
        </div>

        <div className="text-center text-sm text-gray-500">
          Please ensure your face is clearly visible and well-lit
        </div>
      </div>
    </div>
  )
}


