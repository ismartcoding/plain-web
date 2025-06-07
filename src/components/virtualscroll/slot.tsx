import { defineComponent, ref } from "vue"
import { SlotProps } from "./props"
import { useResizeChange } from "./item"

export const VSlot = defineComponent({
  name: 'VirtualListSlot',
  props: SlotProps,
  emits: ['slotResize'],
  setup(props, { slots, emit }) {
    const rootRef = ref<HTMLElement | null>(null)
    useResizeChange(props, rootRef, emit)

    return () => {
      const { uniqueKey } = props

      return (
        <div ref={rootRef} key={uniqueKey}>
          {slots.default?.()}
        </div>
      )
    }
  },
})
