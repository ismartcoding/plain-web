import { ref, onUnmounted, type Ref } from 'vue'
import apollo from '@/plugins/apollo'
import { sendScreenMirrorControlGQL } from '@/lib/api/mutation'

/**
 * Control actions sent to the Android app.
 * - tap: single tap at (x, y)
 * - long_press: long press at (x, y) with duration
 * - swipe: swipe from (x, y) to (endX, endY) with duration
 * - scroll: scroll at (x, y) with delta
 * - back / home / recents / lock_screen: global navigation actions
 * - key: send a key event
 *
 * Coordinates are normalized to [0, 1] relative to the video resolution.
 */

export interface ScreenMirrorControlEvent {
  action: ScreenMirrorControlAction
  x?: number
  y?: number
  endX?: number
  endY?: number
  duration?: number
  deltaX?: number
  deltaY?: number
  key?: string
}

export type ScreenMirrorControlAction =
  | 'TAP'
  | 'LONG_PRESS'
  | 'SWIPE'
  | 'SCROLL'
  | 'BACK'
  | 'HOME'
  | 'RECENTS'
  | 'LOCK_SCREEN'
  | 'KEY'

function sendControl(event: ScreenMirrorControlEvent) {
  apollo.a
    .mutate({
      mutation: sendScreenMirrorControlGQL,
      variables: { input: event },
    })
    .catch((error) => {
      console.error('Failed to send screen mirror control:', error)
    })
}

/**
 * Given a pointer event on an overlay that covers the <video> element,
 * compute the normalized [0,1] coordinates relative to the actual video content
 * (accounting for letterboxing from object-fit: contain).
 */
function normalizeCoords(
  clientX: number,
  clientY: number,
  videoEl: HTMLVideoElement
): { x: number; y: number } | null {
  const rect = videoEl.getBoundingClientRect()
  const videoWidth = videoEl.videoWidth
  const videoHeight = videoEl.videoHeight
  if (!videoWidth || !videoHeight) return null

  const containerW = rect.width
  const containerH = rect.height
  const containerAspect = containerW / containerH
  const videoAspect = videoWidth / videoHeight

  let renderW: number, renderH: number, offsetX: number, offsetY: number

  if (videoAspect > containerAspect) {
    // Letterboxed top/bottom
    renderW = containerW
    renderH = containerW / videoAspect
    offsetX = 0
    offsetY = (containerH - renderH) / 2
  } else {
    // Pillarboxed left/right
    renderH = containerH
    renderW = containerH * videoAspect
    offsetX = (containerW - renderW) / 2
    offsetY = 0
  }

  const localX = clientX - rect.left - offsetX
  const localY = clientY - rect.top - offsetY

  if (localX < 0 || localX > renderW || localY < 0 || localY > renderH) {
    return null // Outside video content area
  }

  return {
    x: Math.max(0, Math.min(1, localX / renderW)),
    y: Math.max(0, Math.min(1, localY / renderH)),
  }
}

const LONG_PRESS_THRESHOLD = 500 // ms
const SWIPE_THRESHOLD = 10 // px movement to consider as swipe

interface GestureState {
  startX: number
  startY: number
  startClientX: number
  startClientY: number
  startTime: number
  longPressTimer: ReturnType<typeof setTimeout> | null
  isLongPress: boolean
  pointerId: number
}

/**
 * Composable that manages screen mirror control input on a transparent overlay.
 *
 * @param videoRef - Ref to the <video> element (for coordinate normalization)
 * @param enabled - Ref<boolean> indicating if control mode is on
 */
export function useScreenMirrorControl(
  videoRef: Ref<HTMLVideoElement | undefined>,
  enabled: Ref<boolean>
) {
  const overlayRef = ref<HTMLDivElement>()
  let gesture: GestureState | null = null

  const onPointerDown = (e: PointerEvent) => {
    if (!enabled.value) return
    const video = videoRef.value
    if (!video) return

    const coords = normalizeCoords(e.clientX, e.clientY, video)
    if (!coords) return

    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    gesture = {
      startX: coords.x,
      startY: coords.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTime: Date.now(),
      longPressTimer: null,
      isLongPress: false,
      pointerId: e.pointerId,
    }

    // Start long press detection
    gesture.longPressTimer = setTimeout(() => {
      if (gesture) {
        gesture.isLongPress = true
        sendControl({
          action: 'LONG_PRESS',
          x: gesture.startX,
          y: gesture.startY,
          duration: LONG_PRESS_THRESHOLD,
        })
      }
    }, LONG_PRESS_THRESHOLD)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!gesture || !enabled.value) return

    const dx = e.clientX - gesture.startClientX
    const dy = e.clientY - gesture.startClientY
    const distance = Math.sqrt(dx * dx + dy * dy)

    // If moved beyond threshold, cancel long press detection
    if (distance > SWIPE_THRESHOLD && gesture.longPressTimer) {
      clearTimeout(gesture.longPressTimer)
      gesture.longPressTimer = null
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    if (!gesture || !enabled.value) return
    const video = videoRef.value
    if (!video) {
      gesture = null
      return
    }

    // Clear long press timer
    if (gesture.longPressTimer) {
      clearTimeout(gesture.longPressTimer)
      gesture.longPressTimer = null
    }

    const dx = e.clientX - gesture.startClientX
    const dy = e.clientY - gesture.startClientY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const duration = Date.now() - gesture.startTime

    if (gesture.isLongPress) {
      // Already sent long_press on timer
    } else if (distance > SWIPE_THRESHOLD) {
      // Swipe
      const endCoords = normalizeCoords(e.clientX, e.clientY, video)
      if (endCoords) {
        sendControl({
          action: 'SWIPE',
          x: gesture.startX,
          y: gesture.startY,
          endX: endCoords.x,
          endY: endCoords.y,
          duration: Math.max(duration, 100),
        })
      }
    } else {
      // Tap
      sendControl({
        action: 'TAP',
        x: gesture.startX,
        y: gesture.startY,
      })
    }

    gesture = null
  }

  const onPointerCancel = () => {
    if (gesture?.longPressTimer) {
      clearTimeout(gesture.longPressTimer)
    }
    gesture = null
  }

  const onWheel = (e: WheelEvent) => {
    if (!enabled.value) return
    const video = videoRef.value
    if (!video) return

    const coords = normalizeCoords(e.clientX, e.clientY, video)
    if (!coords) return

    e.preventDefault()

    sendControl({
      action: 'SCROLL',
      x: coords.x,
      y: coords.y,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!enabled.value) return

    let handled = true
    switch (e.key) {
      case 'Escape':
      case 'Backspace':
        sendControl({ action: 'BACK' })
        break
      case 'Home':
        sendControl({ action: 'HOME' })
        break
      default:
        handled = false
    }

    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const attachOverlay = (el: HTMLDivElement | undefined) => {
    overlayRef.value = el
  }

  const setupListeners = () => {
    const el = overlayRef.value
    if (!el) return

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('keydown', onKeyDown)
  }

  const removeListeners = () => {
    const el = overlayRef.value
    if (!el) return

    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('keydown', onKeyDown)
  }

  onUnmounted(() => {
    removeListeners()
    if (gesture?.longPressTimer) {
      clearTimeout(gesture.longPressTimer)
    }
  })

  return {
    overlayRef,
    attachOverlay,
    setupListeners,
    removeListeners,
    sendControl,
  }
}
