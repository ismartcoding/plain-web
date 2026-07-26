import type { Ref } from 'vue'

/** Overlay pointer handler that intercepts space+click/middle-click for panning. */
export function useOverlayPointer(
  isSpaceDown: Ref<boolean>,
  pan: { startPan: (e: PointerEvent) => void; movePan: (e: PointerEvent) => boolean; endPan: () => boolean },
  delegate: { down: (e: PointerEvent) => void; move: (e: PointerEvent) => void; up: () => void },
) {
  function handleOverlayPointerDown(e: PointerEvent) {
    const target = e.currentTarget as HTMLElement
    if (e.button === 1 || (e.button === 0 && isSpaceDown.value)) {
      e.preventDefault()
      target.setPointerCapture(e.pointerId)
      pan.startPan(e)
      return
    }
    target.setPointerCapture(e.pointerId)
    delegate.down(e)
  }

  function handleOverlayPointerMove(e: PointerEvent) {
    if (pan.movePan(e)) return
    delegate.move(e)
  }

  function handleOverlayPointerUp(_e: PointerEvent) {
    if (pan.endPan()) return
    delegate.up()
  }

  return { handleOverlayPointerDown, handleOverlayPointerMove, handleOverlayPointerUp }
}
