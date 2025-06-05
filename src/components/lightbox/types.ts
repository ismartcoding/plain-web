import type { DataType } from '@/lib/data'

export interface IImgState {
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
  maxScale: number
}

export interface IImgWrapperState {
  scale: number
  lastScale: number
  rotateDeg: number
  top: number
  left: number
  initX: number
  initY: number
  lastX: number
  lastY: number
  touches: TouchList | []
}

export interface IStatus {
  loadError: boolean
  loading: boolean
  dragging: boolean
  gesturing: boolean
  swipeToLeft: boolean
  swipeToRight: boolean
}

export interface ISource {
  src: string
  viewOriginImage?: boolean
  path: string // file path
  name: string
  size: number
  duration: number
  type?: DataType
  fileId?: string
  extension?: string
  thumbnail?: string // video thumbnail
  summary?: string   // text file summary
  data?: any // video, audio, image item
}

export type MouseEventHandler = (e: MouseEvent) => void
export type TouchEventHandler = (e: TouchEvent) => void

export type IndexChangeAction = 'on-prev' | 'on-next' | 'on-prev-click' | 'on-next-click'
export type IndexChangeActions = IndexChangeAction | IndexChangeAction[]
