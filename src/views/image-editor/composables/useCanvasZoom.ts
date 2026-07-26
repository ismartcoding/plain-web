/**
 * Figma-style canvas zoom / pan composable.
 * - Trackpad two-finger scroll → pan
 * - Cmd/Ctrl + Plus/Minus → zoom
 * - Pinch (ctrlKey wheel) → zoom at cursor
 * - Middle-click drag or Space+left-click drag → pan
 *
 * Shared by ImageEditor and MakerEditor.
 */
import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'

export function useCanvasZoom(
  wrapRef: Ref<HTMLElement | null>,
  active: Ref<boolean>,
  canvasSize: Ref<{ width: number; height: number }>,
) {
  const zoom = ref(1)
  const panX = ref(0)
  const panY = ref(0)

  const ZOOM_MIN = 0.1
  const ZOOM_MAX = 5
  const ZOOM_STEP = 1.15

  let isPanning = false
  let panStartX = 0
  let panStartY = 0
  let panStartPanX = 0
  let panStartPanY = 0

  const isSpaceDown = ref(false)

  function zoomAtPoint(clientX: number, clientY: number, factor: number) {
    const wrap = wrapRef.value
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const prevZoom = zoom.value
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prevZoom * factor))
    if (newZoom === prevZoom) return

    const rcx = rect.left + rect.width / 2
    const rcy = rect.top + rect.height / 2
    const ratio = newZoom / prevZoom
    panX.value -= (clientX - rcx) * (ratio - 1)
    panY.value -= (clientY - rcy) * (ratio - 1)
    zoom.value = newZoom
  }

  function onWheel(e: WheelEvent) {
    if (!active.value) return
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomAtPoint(e.clientX, e.clientY, factor)
    } else {
      panX.value -= e.deltaX
      panY.value -= e.deltaY
    }
  }

  function resetZoom() {
    zoom.value = 1
    panX.value = 0
    panY.value = 0
  }

  function startPan(e: PointerEvent) {
    isPanning = true
    panStartX = e.clientX
    panStartY = e.clientY
    panStartPanX = panX.value
    panStartPanY = panY.value
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function movePan(e: PointerEvent) {
    if (!isPanning) return false
    panX.value = panStartPanX + (e.clientX - panStartX)
    panY.value = panStartPanY + (e.clientY - panStartY)
    return true
  }

  function endPan() {
    if (!isPanning) return false
    isPanning = false
    return true
  }

  function onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    if (e.code === 'Space' && !e.repeat) {
      isSpaceDown.value = true
      return
    }

    if (!(e.metaKey || e.ctrlKey)) return
    const wrap = wrapRef.value
    if (!wrap || !active.value) return
    const rect = wrap.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      e.preventDefault()
      zoomAtPoint(cx, cy, ZOOM_STEP)
    } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      e.preventDefault()
      zoomAtPoint(cx, cy, 1 / ZOOM_STEP)
    } else if (e.code === 'Digit0' || e.code === 'Numpad0') {
      e.preventDefault()
      resetZoom()
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      isSpaceDown.value = false
      if (isPanning) isPanning = false
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  })

  watch(canvasSize, () => { resetZoom() })

  return {
    zoom,
    panX,
    panY,
    isSpaceDown,
    onWheel,
    resetZoom,
    startPan,
    movePan,
    endPan,
  }
}
