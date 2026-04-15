<template>
  <div ref="containerRef" class="v-dropdown-container">
    <div @click.prevent.stop="toggleDropdown">
      <slot name="trigger"></slot>
    </div>
    <teleport to="body">
      <div ref="menuRef" class="v-dropdown-portal dropdown-menu" :class="{ 'is-open': modelValue }" :style="menuStyle">
        <slot></slot>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { CSSProperties } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: false,
    default: false,
  },
  maxHeight: {
    type: Number,
    default: 300,
  },
  align: {
    type: String,
    default: 'top-right-to-bottom-right',
    validator: (value: string) =>
      [
        'top-left-to-bottom-left', // Default: menu's top-left to trigger's bottom-left
        'top-right-to-bottom-right', // Menu's top-right to trigger's bottom-right
        'top-right-to-top-left', // Menu's top-right to trigger's top-left
        'top-left-to-top-right', // Menu's top-left to trigger's top-right
        'bottom-left-to-bottom-right', // Menu's bottom-left to trigger's bottom-right
        'bottom-left-to-top-left', // Menu's bottom-left to trigger's top-left (above the trigger)
        'bottom-right-to-top-right', // Menu's bottom-right to trigger's top-right (above the trigger)
      ].includes(value),
  },
})

const emit = defineEmits(['update:modelValue'])

const containerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const contentHeight = ref(0)
const windowHeight = ref(window.innerHeight)
const windowWidth = ref(window.innerWidth)
const menuPosition = ref({ top: 0, bottom: 0, left: 0, right: 0 })

const menuStyle = computed<CSSProperties>(() => {
  // Check if content fits in viewport
  const spaceBelow = windowHeight.value - menuPosition.value.top
  const spaceAbove = menuPosition.value.bottom
  const needsScrolling = contentHeight.value > spaceBelow && contentHeight.value > props.maxHeight

  // Calculate max height for dropdown
  let maxHeight = needsScrolling ? Math.min(props.maxHeight, spaceBelow) : 'auto'

  // Check if we should position above the trigger when space is insufficient below
  const shouldPositionAbove = spaceBelow < Math.min(contentHeight.value, props.maxHeight) && spaceAbove > spaceBelow

  // Base styles — use fixed positioning so the menu escapes any overflow:hidden ancestors
  const styles: CSSProperties = {
    position: 'fixed',
    maxHeight: needsScrolling ? `${maxHeight}px` : 'none',
    overflowY: needsScrolling ? 'auto' : 'visible',
  }

  const { top, bottom, left, right } = menuPosition.value

  // Position based on alignment (all values are viewport-relative px)
  switch (props.align) {
    case 'top-left-to-bottom-left':
      styles.left = `${left}px`
      if (shouldPositionAbove) {
        styles.bottom = `${bottom + 8}px`
      } else {
        styles.top = `${top + 8}px`
      }
      break
    case 'top-right-to-bottom-right':
      styles.right = `${windowWidth.value - right}px`
      if (shouldPositionAbove) {
        styles.bottom = `${bottom + 8}px`
      } else {
        styles.top = `${top + 8}px`
      }
      break
    case 'top-left-to-top-right':
      styles.left = `${right + 8}px`
      styles.top = `${top}px`
      break
    case 'bottom-left-to-bottom-right':
      styles.left = `${right + 8}px`
      styles.top = `${bottom}px`
      break
    case 'top-right-to-top-left':
      styles.right = `${windowWidth.value - left + 8}px`
      styles.top = `${top}px`
      break
    case 'bottom-left-to-top-left':
      styles.left = `${left}px`
      styles.bottom = `${bottom + 8}px`
      break
    case 'bottom-right-to-top-right':
      styles.right = `${windowWidth.value - right}px`
      styles.bottom = `${bottom + 8}px`
      break
    default:
      styles.left = `${left}px`
      if (shouldPositionAbove) {
        styles.bottom = `${bottom + 8}px`
      } else {
        styles.top = `${top + 8}px`
      }
  }

  return styles
})

const toggleDropdown = () => {
  // Send event to notify other dropdowns to close
  if (!props.modelValue) {
    // Only send close event when we're about to open this dropdown
    document.dispatchEvent(new CustomEvent('dropdown-toggle', { detail: { exclude: containerRef.value } }))
  }
  emit('update:modelValue', !props.modelValue)
}

const handleDropdownToggle = (event: Event) => {
  // Close current dropdown if the event is from another dropdown
  const customEvent = event as CustomEvent
  if ((customEvent.detail?.exclude === null || customEvent.detail?.exclude !== containerRef.value) && props.modelValue) {
    emit('update:modelValue', false)
  }
}

const updatePosition = () => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    menuPosition.value = {
      top: rect.bottom,
      bottom: windowHeight.value - rect.top,
      left: rect.left,
      right: rect.right,
    }
  }
}

const updateContentHeight = () => {
  if (menuRef.value) {
    // Temporarily remove max-height to measure full content height
    const originalStyle = menuRef.value.style.maxHeight
    menuRef.value.style.maxHeight = 'none'
    contentHeight.value = menuRef.value.scrollHeight
    menuRef.value.style.maxHeight = originalStyle

    // Calculate the optimal width based on content
    calculateOptimalWidth()
  }
}

const calculateOptimalWidth = () => {
  if (menuRef.value && containerRef.value) {
    // Reset width to auto to get natural content width
    menuRef.value.style.width = 'auto'

    // Get the natural width of the menu
    const menuWidth = menuRef.value.scrollWidth

    // Check all child elements to ensure we get the maximum width needed
    let maxChildWidth = 0
    Array.from(menuRef.value.children).forEach((child) => {
      const childWidth = (child as HTMLElement).scrollWidth
      maxChildWidth = Math.max(maxChildWidth, childWidth)
    })

    // Use the larger of the menu width or max child width
    const finalWidth = Math.max(menuWidth, maxChildWidth)

    // Add a small padding (10px) to ensure text fits comfortably
    menuRef.value.style.width = `${finalWidth + 10}px`
  }
}

const handleResize = () => {
  windowHeight.value = window.innerHeight
  windowWidth.value = window.innerWidth
  updatePosition()
  if (props.modelValue) {
    updateContentHeight()
  }
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (
    containerRef.value && !containerRef.value.contains(target) &&
    menuRef.value && !menuRef.value.contains(target) &&
    props.modelValue
  ) {
    emit('update:modelValue', false)
  }
}

const handleGlobalClick = (event: MouseEvent) => {
  // Close dropdown on any click, even if event.stopPropagation() was called
  const target = event.target as Node
  if (
    props.modelValue &&
    containerRef.value && !containerRef.value.contains(target) &&
    menuRef.value && !menuRef.value.contains(target)
  ) {
    emit('update:modelValue', false)
  }
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      updatePosition()
      await nextTick()
      updateContentHeight()
      // Also need to calculate optimal width after content has rendered
      await nextTick()
      calculateOptimalWidth()
    }
  }
)

onMounted(() => {
  window.addEventListener('resize', handleResize)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('click', handleGlobalClick, { capture: true })
  document.addEventListener('dropdown-toggle', handleDropdownToggle as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('click', handleGlobalClick, { capture: true })
  document.removeEventListener('dropdown-toggle', handleDropdownToggle as EventListener)
})
</script>

<style lang="scss" scoped>
.v-dropdown-container {
  position: relative;
  display: inline-block;
}
</style>

<style lang="scss">
.v-dropdown-portal {
  display: none;
  background-color: var(--md-sys-color-surface-container);
  border-radius: 4px;
  box-shadow: rgba(0, 0, 0, 0.2) 0px 2px 6px 0px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  z-index: 1050;
  white-space: nowrap;

  & > * {
    white-space: nowrap;
  }

  &.is-open {
    display: block;
  }

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--md-sys-color-outline);
    border-radius: 3px;
  }
}
</style>
