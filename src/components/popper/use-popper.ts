import { toRefs, watch, nextTick, onBeforeUnmount, reactive } from 'vue'
import { createPopper } from '@popperjs/core/lib/popper-lite.js'
import preventOverflow from '@popperjs/core/lib/modifiers/preventOverflow.js'
import offset from '@popperjs/core/lib/modifiers/offset'
import arrow from '@popperjs/core/lib/modifiers/arrow'
import flip from '@popperjs/core/lib/modifiers/flip.js'

export default function usePopper({ emit, placement, popperNode, triggerNode }) {
  const state = reactive({
    isOpen: false,
    popperInstance: null,
  })

  // Enable or disable event listeners to optimize performance.
  const setPopperEventListeners = (enabled: boolean) => {
    ;(state.popperInstance as any)?.setOptions((options: { modifiers: any }) => ({
      ...options,
      modifiers: [...options.modifiers, { name: 'eventListeners', enabled }],
    }))
  }

  const enablePopperEventListeners = () => setPopperEventListeners(true)
  const disablePopperEventListeners = () => setPopperEventListeners(false)

  const close = () => {
    if (!state.isOpen) {
      return
    }

    state.isOpen = false
    emit('close:popper')
  }

  const open = () => {
    if (state.isOpen) {
      return
    }

    state.isOpen = true
    emit('open:popper')
  }

  // When isOpen or placement change
  watch([() => state.isOpen, placement], async ([isOpen]) => {
    if (isOpen) {
      await initializePopper()
      enablePopperEventListeners()
    } else {
      disablePopperEventListeners()
    }
  })

  const initializePopper = async () => {
    await nextTick()
    state.popperInstance = createPopper(triggerNode.value, popperNode.value, {
      placement: placement.value,
      modifiers: [
        preventOverflow,
        arrow,
        {
          name: 'arrow',
          options: {
            padding: 0,
          },
        },
        flip,
        {
          name: 'flip',
          enabled: true,
        },
        offset,
        {
          name: 'offset',
          options: {
            offset: [0, 8],
          },
        },
      ],
    })

    // Update its position
    state.popperInstance?.update()
  }

  onBeforeUnmount(() => {
    state.popperInstance?.destroy()
  })

  return {
    ...toRefs(state),
    open,
    close,
  }
}
