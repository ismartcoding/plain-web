<template>
  <div class="inline-block" @mouseleave="hover && closePopper()" ref="popperContainerNode" v-click-away="closePopper">
    <div
      ref="triggerNode"
      @mouseover="hover && openPopper()"
      @click.stop="togglePopper"
      @focus="openPopper"
      @keyup.esc="closePopper"
    >
      <slot />
    </div>
    <transition name="fade">
      <div v-show="shouldShowPopper" class="popper" ref="popperNode">
        <slot name="content" :close="close" :isOpen="modifiedIsOpen">
          {{ content }}
        </slot>
        <arrow v-if="arrow" />
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
      return [
        'auto',
        'auto-start',
        'auto-end',
        'top',
        'top-start',
        'top-end',
        'bottom',
        'bottom-start',
        'bottom-end',
        'right',
        'right-start',
        'right-end',
        'left',
        'left-start',
        'left-end',
      ].includes(value)
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
  arrow: {
    type: Boolean,
    default: true,
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
  background: var(--back-color);
  color: var(--text-color);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-color);
  z-index: v-bind(zIndex);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
