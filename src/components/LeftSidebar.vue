<template>
  <aside class="sidebar" :class="{ mini: miniSidebar }" :style="{ width: mainStore.sidebarWidth + 'px' }">
    <div class="top-app-bar">
      <button v-tooltip="$t(miniSidebar ? 'open' : 'close')" class="btn-icon" @click.prevent="toggleSidebar">
        
        <i-material-symbols:left-panel-open-outline-rounded v-if="miniSidebar" />
        <i-material-symbols:left-panel-close-outline-rounded v-else />
      </button>
      <div class="title">
        <slot name="title" />
      </div>
      <div class="actions" style="position: relative">
        <slot name="actions" />
      </div>
    </div>
    <div class="sidebar-body">
      <slot name="body" />
    </div>
    <div v-show="!miniSidebar" class="sidebar-drag-indicator" @mousedown="resizeWidth"></div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import router from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useLeftSidebarResize } from '@/hooks/sidebar'

const mainStore = useMainStore()

const currentPage = mainStore.getCurrentPage(router.currentRoute.value.fullPath)
const miniSidebar = ref(currentPage.sidebar === false)

function toggleSidebar() {
  miniSidebar.value = !miniSidebar.value
  mainStore.updatePageSidebar(router.currentRoute.value.fullPath, !miniSidebar.value)
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
