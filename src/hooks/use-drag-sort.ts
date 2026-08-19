import { ref, onBeforeUnmount, type Ref } from 'vue'

interface UseDragSortOptions {
  containerRef: Ref<HTMLElement | undefined | null>
  itemSelector?: string
  onEnd?: (from: number, to: number) => void
}

export function useDragSort({ containerRef, itemSelector = '.item', onEnd }: UseDragSortOptions) {
  const fromIndex = ref(-1)
  const toIndex = ref(-1)
  const dragging = ref(false)
  const suppressClick = ref(false)
  /** 被拖拽项跟随指针的纵向偏移（px） */
  const dragDelta = ref(0)

  let startY = 0
  let itemHeight = 0

  function rows() {
    const c = containerRef.value
    return c ? Array.from(c.querySelectorAll<HTMLElement>(itemSelector)) : []
  }

  function setTextSelectionEnabled(enabled: boolean) {
    const style = document.body.style
    style.userSelect = enabled ? '' : 'none'
    style.webkitUserSelect = enabled ? '' : 'none'
  }

  function onSelectStart(e: Event) {
    if (dragging.value) e.preventDefault()
  }

  /** 每个 item 的样式：被拖拽项跟随指针，其余项腾出落点空隙 */
  function itemStyle(index: number): Record<string, string> {
    if (!dragging.value || fromIndex.value < 0) return {}
    const from = fromIndex.value
    const to = toIndex.value
    if (index === from) {
      return {
        transform: `translateY(${dragDelta.value}px)`,
        transition: 'none',
        position: 'relative',
        zIndex: '10',
      }
    }
    let dy = 0
    if (from < to && index > from && index <= to) dy = -itemHeight
    else if (from > to && index >= to && index < from) dy = itemHeight
    if (dy === 0) return {}
    return { transform: `translateY(${dy}px)` }
  }

  function move(e: PointerEvent) {
    if (e.cancelable) e.preventDefault()
    dragDelta.value = e.clientY - startY
    if (Math.abs(dragDelta.value) > 4) suppressClick.value = true
    const els = rows()
    const container = containerRef.value
    if (!els.length || !container) return
    const rect = container.getBoundingClientRect()
    const y = Math.min(Math.max(e.clientY, rect.top), rect.bottom) - rect.top
    let target = 0
    let offset = 0
    for (let i = 0; i < els.length; i++) {
      if (y < offset + els[i].offsetHeight / 2) {
        target = i
        break
      }
      offset += els[i].offsetHeight
      target = i
    }
    toIndex.value = target
  }

  function end() {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    setTextSelectionEnabled(true)
    document.removeEventListener('selectstart', onSelectStart)
    const from = fromIndex.value
    const to = toIndex.value
    dragging.value = false
    fromIndex.value = -1
    toIndex.value = -1
    dragDelta.value = 0
    if (from < 0 || to < 0 || from === to) return
    onEnd?.(from, to)
  }

  function start(e: PointerEvent, index: number) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    suppressClick.value = false
    dragging.value = true
    fromIndex.value = index
    toIndex.value = index
    dragDelta.value = 0
    startY = e.clientY
    const el = rows()[index]
    itemHeight = el?.offsetHeight ?? 0
    setTextSelectionEnabled(false)
    document.addEventListener('selectstart', onSelectStart)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  onBeforeUnmount(() => {
    if (dragging.value) end()
  })

  return { fromIndex, toIndex, dragging, suppressClick, itemStyle, start }
}