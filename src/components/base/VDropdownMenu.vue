<template>
  <div class="v-dropdown-menu" :class="{ 'is-open': modelValue }" @click.stop>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  anchor: { type: String, required: true }
})

const emit = defineEmits(['update:modelValue'])

const SPACING = 8
const MIN_WIDTH = 120
const MIN_HEIGHT = 80
const MENU_SELECTOR = '.v-dropdown-menu.is-open'

let anchorElement: HTMLElement | null = null

const getOpenMenu = (): HTMLElement | null => document.querySelector(MENU_SELECTOR)

const closeMenu = () => emit('update:modelValue', false)

const isClickOutsideMenu = (event: MouseEvent): boolean => {
  if (!anchorElement?.contains(event.target as Node)) {
    const menu = getOpenMenu()
    return !menu?.contains(event.target as Node)
  }
  return false
}

const updatePosition = (menuElement: HTMLElement) => {
  if (!anchorElement || !menuElement) return
  
  const rect = anchorElement.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    setTimeout(() => updatePosition(menuElement), 10)
    return
  }
  
  const { innerWidth: viewportWidth, innerHeight: viewportHeight } = window
  const scrollY = window.scrollY || document.documentElement.scrollTop
  const scrollX = window.scrollX || document.documentElement.scrollLeft
  
  const menuWidth = menuElement.offsetWidth || MIN_WIDTH
  const menuHeight = menuElement.offsetHeight || MIN_HEIGHT
  
  let top = rect.bottom + scrollY + SPACING
  let left = rect.left + scrollX
  
  // Horizontal boundary check
  if (left + menuWidth > viewportWidth) {
    left = rect.right + scrollX - menuWidth
  }
  left = Math.max(scrollX + SPACING, left)
  
  // Vertical boundary check  
  if (top + menuHeight > viewportHeight + scrollY) {
    top = rect.top + scrollY - menuHeight - SPACING
    if (top < scrollY) {
      top = scrollY + SPACING
      menuElement.style.maxHeight = `${viewportHeight - 16}px`
      menuElement.style.overflowY = 'auto'
    }
  }
  
  menuElement.style.top = `${Math.max(0, top)}px`
  menuElement.style.left = `${Math.max(0, left)}px`
  
  // Make menu visible after positioning
  menuElement.style.opacity = '1'
  menuElement.style.visibility = 'visible'
}

const handleOutsideClick = (event: MouseEvent) => {
  if (isClickOutsideMenu(event)) closeMenu()
}

const handleDropdownToggle = (event: Event) => {
  const { detail } = event as CustomEvent
  if (props.modelValue && (!detail?.exclude || detail.exclude !== anchorElement)) {
    closeMenu()
  }
}

const positionMenu = async () => {
  anchorElement = document.getElementById(props.anchor)
  if (!anchorElement) return
  
  await nextTick()
  setTimeout(() => {
    const menu = getOpenMenu()
    if (menu) updatePosition(menu)
  }, 10)
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    positionMenu()
  } else {
    // Reset menu state when closing
    const menu = getOpenMenu()
    if (menu) {
      menu.style.opacity = '0'
      menu.style.visibility = 'hidden'
    }
  }
})

watch(() => props.anchor, (newAnchor, oldAnchor) => {
  if (props.modelValue && newAnchor !== oldAnchor) positionMenu()
})

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
  document.addEventListener('click', handleOutsideClick, { capture: true })
  document.addEventListener('dropdown-toggle', handleDropdownToggle as EventListener)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  document.removeEventListener('click', handleOutsideClick, { capture: true })
  document.removeEventListener('dropdown-toggle', handleDropdownToggle as EventListener)
})
</script>

<style lang="scss" scoped>
.v-dropdown-menu {
  display: none;
  position: fixed;
  background: var(--md-sys-color-surface-container);
  border-radius: 4px;
  box-shadow: rgba(0, 0, 0, 0.2) 0px 2px 6px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  z-index: 1000;
  white-space: nowrap;
  min-width: 120px;
  max-width: 300px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 150ms ease-out;

  &.is-open { 
    display: block;
  }

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { 
    background: var(--md-sys-color-outline);
    border-radius: 3px;
  }
  
  scrollbar-width: thin;
  scrollbar-color: var(--md-sys-color-outline) transparent;
}
</style> 