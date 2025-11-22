export type NormalizedPoint = {
  x: number
  y: number
}

export type AnnotationShape = 'circle' | 'arrow'

export type AnnotationDrawMessage = {
  kind: 'annotation'
  id: string
  shape: AnnotationShape
  start: NormalizedPoint
  end: NormalizedPoint
  color?: string
  ttlMs?: number
}

export type AnnotationClearMessage = {
  kind: 'clear'
  targetId?: string
}

export type AnnotationMessage = AnnotationDrawMessage | AnnotationClearMessage

export const ANNOTATION_CHANNEL_LABEL = 'annotations'
export const DEFAULT_ANNOTATION_TTL = 20000

