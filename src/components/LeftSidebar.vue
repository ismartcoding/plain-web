<template>
  <aside class="sidebar" :class="{ mini: mainStore.miniSidebar }" :style="{ width: mainStore.sidebarWidth + 'px' }">
    <div v-if="hasTopBar" class="top-app-bar">
      <div class="title">
        <slot name="title" />
      </div>
      <div class="actions" style="position: relative">
        <slot name="actions" />
      </div>
    </div>
    <div class="sidebar-body" @click="handleMenuClick">
      <slot name="body" />
    </div>
    <div v-show="!mainStore.miniSidebar" class="sidebar-drag-indicator" @mousedown="resizeWidth"></div>
  </aside>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { useMainStore } from '@/stores/main'
import { useLeftSidebarResize } from '@/hooks/sidebar'

const mainStore = useMainStore()
const slots = useSlots()

const hasTopBar = computed(() => !!slots.title || !!slots.actions)

function handleMenuClick(event: MouseEvent) {
  // Auto close sidebar on mobile when clicking menu items
  if (window.innerWidth <= 768) {
    const target = event.target as Element
    // Check if clicked element is a menu item (li, nav item, etc.)
    if (target.closest('li') || target.closest('.nav-item')) {
      mainStore.miniSidebar = true
    }
  }
}

const { resizeWidth } = useLeftSidebarResize(
  160,
  () => {
    return mainStore.sidebarWidth
  },
  (width: number) => {
    mainStore.sidebarWidth = width
  }
)
</script>
