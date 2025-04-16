<template>
  <div ref="popperContainerNode" v-click-away="closePopper" class="inline-block" @mouseleave="hover && closePopper()">
    <div ref="triggerNode" @mouseover="hover && openPopper()" @click.stop.prevent="togglePopper" @focus="openPopper" @keyup.esc="closePopper">
      <slot />
    </div>
    <transition name="fade">
      <div v-show="shouldShowPopper" ref="popperNode" class="popper" @click.stop="() => {}">
        <slot name="content" :close="close" :is-open="modifiedIsOpen">
          {{ content }}
        </slot>
      </div>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, useSlots, toRefs, watch, watchEffect } from 'vue'
import useContent from './use-content'
import usePopper from './use-popper'

const emit = defineEmits(['open:popper', 'close:popper'])
const slots = useSlots()
const props = defineProps({
  placement: {
    type: String,
    default: 'bottom',
    validator: function (value: string) {
      return ['auto', 'auto-start', 'auto-end', 'top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end', 'right', 'right-start', 'right-end', 'left', 'left-start', 'left-end'].includes(
        value
      )
    },
  },
  hover: {
    type: Boolean,
    default: false,
  },
  show: {
    type: Boolean,
    default: null,
  },
  zIndex: {
    type: [Number, String],
    default: 9999,
  },
  content: {
    type: String,
    default: null,
  },
})

const popperContainerNode = ref(null)
const popperNode = ref(null)
const triggerNode = ref(null)
const modifiedIsOpen = ref(false)

const { content, placement, show } = toRefs(props)

const { isOpen, open, close } = usePopper({
  emit,
  placement,
  popperNode,
  triggerNode,
})

const { hasContent } = useContent(slots, popperNode, content)

const manualMode = computed(() => show.value !== null)
const invalid = computed(() => !hasContent.value)
const shouldShowPopper = computed(() => isOpen.value && !invalid.value)

const openPopper = async () => {
  if (invalid.value || manualMode.value) {
    return
  }

  open()
}

const closePopper = async () => {
  if (manualMode.value) {
    return
  }

  close()
}

const togglePopper = () => {
  isOpen.value ? closePopper() : openPopper()
}

watch([hasContent], ([hasContent]) => {
  if (isOpen.value && !hasContent) {
    close()
  }
})

watch(isOpen, (isOpen) => {
  modifiedIsOpen.value = isOpen
})

watchEffect(() => {
  if (manualMode.value) {
    show.value ? open() : close()
  }
})
</script>

<style lang="scss" scoped>
.inline-block {
  display: inline-block;
}

.popper {
  transition: background 250ms ease-in-out;
  box-shadow: var(--md-sys-color-shadow) 0px 1px 2px 0px;
  background-color: var(--md-sys-color-surface-container);
  border-radius: 4px;
  z-index: v-bind(zIndex);
  overflow-y: auto;
}
</style>
