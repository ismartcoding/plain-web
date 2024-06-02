<template>
  <aside class="sidebar" :class="{ mini: miniSidebar }" :style="{ width: mainStore.sidebarWidth + 'px' }">
    <div class="top-app-bar">
      <button class="btn-icon" v-tooltip="$t(miniSidebar ? 'open' : 'close')" @click.prevent="toggleSidebar">
        <md-ripple />
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
    <div class="drag-indicator" v-show="!miniSidebar" @mousedown="initResize"></div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import router from '@/plugins/router'
import { useMainStore } from '@/stores/main'

const mainStore = useMainStore()

const currentPage = mainStore.getCurrentPage(router.currentRoute.value.fullPath)
const miniSidebar = ref(currentPage.sidebar === false)

function toggleSidebar() {
  miniSidebar.value = !miniSidebar.value
  mainStore.updatePageSidebar(router.currentRoute.value.fullPath, !miniSidebar.value)
}

function initResize(e: MouseEvent) {
  const startX = e.clientX
  const startWidth = mainStore.sidebarWidth
  const appElement = document.getElementById('app')
  if (appElement) {
    appElement.style.userSelect = 'none'
  }
  const move = (e: MouseEvent) => {
    let width = startWidth + (e.clientX - startX)
    if (width < 160) {
      width = 160
    }
    mainStore.sidebarWidth = width
  }
  const up = () => {
    appElement?.style.removeProperty('user-select')
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
</script>
<style lang="scss" scoped>
.drag-indicator {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 16px;
  cursor: col-resize;
}
</style>
