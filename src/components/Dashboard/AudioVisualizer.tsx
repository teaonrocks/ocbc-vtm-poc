import { useEffect, useRef } from 'react'

interface AudioVisualizerProps {
  audioStream: MediaStream | null
  isRecording: boolean
}

export function AudioVisualizer({ audioStream, isRecording }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const analyserRef = useRef<AnalyserNode | null>(null)

  useEffect(() => {
    if (!audioStream || !canvasRef.current) return

    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    const microphone = audioContext.createMediaStreamSource(audioStream)

    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    microphone.connect(analyser)

    analyserRef.current = analyser

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      if (!isRecording) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        return
      }

      animationFrameRef.current = requestAnimationFrame(draw)

      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let barHeight
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height * 0.8

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight)
        gradient.addColorStop(0, '#06b6d4')
        gradient.addColorStop(0.5, '#3b82f6')
        gradient.addColorStop(1, '#8b5cf6')

        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)

        x += barWidth + 1
      }
    }

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      audioContext.close()
    }
  }, [audioStream, isRecording])

  return (
    <div className="w-full h-32 bg-black/50 rounded-lg overflow-hidden border border-cyan-500/30">
      <canvas
        ref={canvasRef}
        width={800}
        height={128}
        className="w-full h-full"
      />
    </div>
  )
}


