<template>
  <div class="v-dropdown-menu" :class="{ 'is-open': modelValue }" @click.stop>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  anchor: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

let anchorElement: HTMLElement | null = null

const updatePosition = (menuElement: HTMLElement) => {
  if (!anchorElement || !menuElement) return
  
  const rect = anchorElement.getBoundingClientRect()
  
  // Ensure the anchor element is rendered and has a valid position
  if (rect.width === 0 && rect.height === 0) {
    // Retry if the anchor element is not ready
    setTimeout(() => updatePosition(menuElement), 10)
    return
  }
  
  // Calculate menu position, keep it within viewport
  const scrollY = window.scrollY || document.documentElement.scrollTop
  const scrollX = window.scrollX || document.documentElement.scrollLeft
  
  const top = rect.bottom + scrollY + 8
  const left = rect.left + scrollX
  
  // Prevent negative or invalid values
  menuElement.style.top = `${Math.max(0, top)}px`
  menuElement.style.left = `${Math.max(0, left)}px`
}

const handleClickOutside = (event: MouseEvent) => {
  if (anchorElement && !anchorElement.contains(event.target as Node)) {
    const menu = document.querySelector('.dropdown-menu.is-open') as HTMLElement
    if (menu && !menu.contains(event.target as Node)) {
      emit('update:modelValue', false)
    }
  }
}

const handleGlobalClick = (event: MouseEvent) => {
  // Close dropdown on any click, even if event.stopPropagation() was called
  if (props.modelValue && anchorElement && !anchorElement.contains(event.target as Node)) {
    const menu = document.querySelector('.dropdown-menu.is-open') as HTMLElement
    if (menu && !menu.contains(event.target as Node)) {
      emit('update:modelValue', false)
    }
  }
}

const handleDropdownToggle = (event: Event) => {
  const customEvent = event as CustomEvent
  // Close if event is for closing all dropdowns (exclude === null) or from a different dropdown
  if ((customEvent.detail?.exclude === null || customEvent.detail?.exclude !== anchorElement) && props.modelValue) {
    emit('update:modelValue', false)
  }
}

watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    anchorElement = document.getElementById(props.anchor)
    if (anchorElement) {
      // Wait for DOM update
      await nextTick()
      const menu = document.querySelector('.dropdown-menu.is-open') as HTMLElement
      if (menu) {
        updatePosition(menu)
      }
    }
  }
})

// Watch anchor changes, update anchor element and menu position
watch(() => props.anchor, async (newAnchor, oldAnchor) => {
  // Only update if menu is open and anchor actually changed
  if (props.modelValue && newAnchor && newAnchor !== oldAnchor) {
    anchorElement = document.getElementById(newAnchor)
    if (anchorElement) {
      await nextTick()
      const menu = document.querySelector('.dropdown-menu.is-open') as HTMLElement
      if (menu) {
        updatePosition(menu)
      }
    }
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('click', handleGlobalClick, { capture: true })
  document.addEventListener('dropdown-toggle', handleDropdownToggle as EventListener)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('click', handleGlobalClick, { capture: true })
  document.removeEventListener('dropdown-toggle', handleDropdownToggle as EventListener)
})
</script>

<style lang="scss" scoped>
.v-dropdown-menu {
  display: none;
  position: fixed;
  background-color: var(--md-sys-color-surface-container);
  border-radius: 4px;
  box-shadow: rgba(0, 0, 0, 0.2) 0px 2px 6px 0px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  z-index: 1000;
  white-space: nowrap;
  min-width: 120px;

  &.is-open {
    display: block;
  }
}
</style> 