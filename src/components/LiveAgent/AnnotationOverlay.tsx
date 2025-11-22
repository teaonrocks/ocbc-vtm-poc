import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  AnnotationDrawMessage,
  NormalizedPoint,
} from '../../types/annotations'

const SVG_SIZE = 1000

export type RenderableAnnotation = AnnotationDrawMessage & {
  createdAt: number
}

type AnnotationOverlayProps = {
  annotations: RenderableAnnotation[]
  visible?: boolean
}

const toSvg = (point: NormalizedPoint) => ({
  x: point.x * SVG_SIZE,
  y: point.y * SVG_SIZE,
})

function renderCircle(annotation: RenderableAnnotation) {
  const start = toSvg(annotation.start)
  const end = toSvg(annotation.end)
  const cx = (start.x + end.x) / 2
  const cy = (start.y + end.y) / 2
  const rx = Math.abs(start.x - end.x) / 2
  const ry = Math.abs(start.y - end.y) / 2
  return (
    <ellipse
      key={annotation.id}
      cx={cx}
      cy={cy}
      rx={Math.max(rx, 5)}
      ry={Math.max(ry, 5)}
      stroke={annotation.color ?? '#f97316'}
      strokeWidth={12}
      fill="transparent"
      opacity={0.85}
    />
  )
}

function renderArrow(annotation: RenderableAnnotation) {
  const start = toSvg(annotation.start)
  const end = toSvg(annotation.end)
  const color = annotation.color ?? '#34d399'
  return (
    <line
      key={annotation.id}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={color}
      strokeWidth={14}
      strokeLinecap="round"
      markerEnd="url(#annotation-arrowhead)"
      opacity={0.9}
    />
  )
}

const shapeRenderer = {
  circle: renderCircle,
  arrow: renderArrow,
} satisfies Record<
  AnnotationDrawMessage['shape'],
  (annotation: RenderableAnnotation) => JSX.Element
>

export function AnnotationOverlay({
  annotations,
  visible = true,
}: AnnotationOverlayProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !visible || annotations.length === 0) {
    return null
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id="annotation-arrowhead"
            markerWidth="20"
            markerHeight="20"
            refX="10"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,10 L10,5 z" fill="#34d399" />
          </marker>
        </defs>
        {annotations.map((annotation) =>
          shapeRenderer[annotation.shape](annotation),
        )}
      </svg>
    </div>,
    document.body,
  )
}

