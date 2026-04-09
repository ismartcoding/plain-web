import { toRefs, watch, nextTick, onBeforeUnmount, reactive, type Ref } from 'vue'

export type Placement =
  | 'auto' | 'auto-start' | 'auto-end'
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'right' | 'right-start' | 'right-end'
  | 'left' | 'left-start' | 'left-end'

const OFFSET = 8

function applyPosition(triggerEl: HTMLElement, popperEl: HTMLElement, placement: Placement) {
  const t = triggerEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const pw = popperEl.offsetWidth
  const ph = popperEl.offsetHeight
  const parts = placement.split('-')
  const base = parts[0] as 'top' | 'bottom' | 'left' | 'right' | 'auto'
  const align = (parts[1] ?? 'center') as 'start' | 'end' | 'center'

  // Resolve 'auto' and flip if there's no room
  let side = base === 'auto' ? 'bottom' : base
  if (side === 'bottom' && t.bottom + ph + OFFSET > vh && t.top - ph - OFFSET >= 0) side = 'top'
  else if (side === 'top' && t.top - ph - OFFSET < 0 && t.bottom + ph + OFFSET <= vh) side = 'bottom'
  else if (side === 'right' && t.right + pw + OFFSET > vw && t.left - pw - OFFSET >= 0) side = 'left'
  else if (side === 'left' && t.left - pw - OFFSET < 0 && t.right + pw + OFFSET <= vw) side = 'right'

  let top = 0
  let left = 0

  if (side === 'bottom') top = t.bottom + OFFSET
  else if (side === 'top') top = t.top - ph - OFFSET
  else if (side === 'right') { left = t.right + OFFSET; top = t.top }
  else { left = t.left - pw - OFFSET; top = t.top }

  if (side === 'top' || side === 'bottom') {
    if (align === 'start') left = t.left
    else if (align === 'end') left = t.right - pw
    else left = t.left + (t.width - pw) / 2
    left = Math.max(4, Math.min(left, vw - pw - 4))
  } else {
    if (align === 'start') top = t.top
    else if (align === 'end') top = t.bottom - ph
    else top = t.top + (t.height - ph) / 2
    top = Math.max(4, Math.min(top, vh - ph - 4))
  }

  const resolved = align === 'center' ? side : `${side}-${align}`
  popperEl.setAttribute('data-popper-placement', resolved)
  popperEl.style.position = 'fixed'
  popperEl.style.margin = '0'
  popperEl.style.top = `${Math.round(top)}px`
  popperEl.style.left = `${Math.round(left)}px`
}

export default function usePopper({
  emit,
  placement,
  popperNode,
  triggerNode,
}: {
  emit: (event: string, ...args: any[]) => void
  placement: Ref<Placement>
  popperNode: Ref<HTMLElement | null>
  triggerNode: Ref<HTMLElement | null>
}) {
  const state = reactive({ isOpen: false })

  const update = () => {
    if (triggerNode.value && popperNode.value) {
      applyPosition(triggerNode.value, popperNode.value, placement.value)
    }
  }

  const close = () => {
    if (!state.isOpen) return
    state.isOpen = false
    emit('close:popper')
    window.removeEventListener('scroll', update, true)
    window.removeEventListener('resize', update)
  }

  const open = () => {
    if (state.isOpen) return
    state.isOpen = true
    emit('open:popper')
  }

  watch([() => state.isOpen, placement], async ([isOpen]) => {
    if (isOpen) {
      await nextTick()
      update()
      window.addEventListener('scroll', update, true)
      window.addEventListener('resize', update)
    } else {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', update, true)
    window.removeEventListener('resize', update)
  })

  return { ...toRefs(state), open, close }
}
