import { useMemo, useRef, useState } from 'react'
import type {
  AnnotationDrawMessage,
  AnnotationShape,
  NormalizedPoint,
} from '../../types/annotations'
import { DEFAULT_ANNOTATION_TTL } from '../../types/annotations'

type AnnotationSurfaceProps = {
  tool: AnnotationShape
  color?: string
  disabled?: boolean
  onEmit: (message: AnnotationDrawMessage) => void
}

const SVG_SIZE = 1000

const clamp = (value: number) => Math.min(1, Math.max(0, value))

const toSvg = (point: NormalizedPoint) => ({
  x: point.x * SVG_SIZE,
  y: point.y * SVG_SIZE,
})

export function AnnotationSurface({
  tool,
  color = '#f97316',
  disabled,
  onEmit,
}: AnnotationSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const [draft, setDraft] = useState<AnnotationDrawMessage | null>(null)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }
    event.preventDefault()
    const point = toNormalizedPoint(event)
    if (!point) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraft({
      kind: 'annotation',
      id: crypto.randomUUID(),
      shape: tool,
      start: point,
      end: point,
      color,
      ttlMs: DEFAULT_ANNOTATION_TTL,
    })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draft) {
      return
    }
    event.preventDefault()
    const point = toNormalizedPoint(event)
    if (!point) {
      return
    }
    setDraft((current) =>
      current
        ? {
            ...current,
            end: point,
          }
        : current,
    )
  }

  const finalizeDraft = () => {
    setDraft((current) => {
      if (current) {
        onEmit(current)
      }
      return null
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draft) {
      event.preventDefault()
      finalizeDraft()
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draft) {
      event.preventDefault()
      finalizeDraft()
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const renderedDraft = useMemo(() => {
    if (!draft) {
      return null
    }
    if (draft.shape === 'circle') {
      const start = toSvg(draft.start)
      const end = toSvg(draft.end)
      const cx = (start.x + end.x) / 2
      const cy = (start.y + end.y) / 2
      const rx = Math.max(Math.abs(start.x - end.x) / 2, 5)
      const ry = Math.max(Math.abs(start.y - end.y) / 2, 5)
      return (
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={draft.color ?? color}
          strokeWidth={10}
          fill="transparent"
        />
      )
    }
    const start = toSvg(draft.start)
    const end = toSvg(draft.end)
    return (
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={draft.color ?? color}
        strokeWidth={12}
        strokeLinecap="round"
      />
    )
  }, [draft, color])

  return (
    <div
      ref={surfaceRef}
      className={`pointer-events-auto absolute inset-0 ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'} select-none touch-none`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-white text-sm font-semibold">
          Data channel offline
        </div>
      )}
      {!disabled && draft && (
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          preserveAspectRatio="none"
        >
          {renderedDraft}
        </svg>
      )}
    </div>
  )

  function toNormalizedPoint(
    event: React.PointerEvent<HTMLDivElement>,
  ): NormalizedPoint | null {
    const surface = surfaceRef.current
    if (!surface) {
      return null
    }
    const rect = surface.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return null
    }
    const x = clamp((event.clientX - rect.left) / rect.width)
    const y = clamp((event.clientY - rect.top) / rect.height)
    return { x, y }
  }
}

