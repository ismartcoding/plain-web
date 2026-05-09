<template>
  <div class="tauri-tab-bar">
    <div class="left-controls">
      <button class="bar-btn" title="Back" @click="goBack">
        <i-material-symbols:arrow-back-ios-new-rounded />
      </button>
      <button class="bar-btn" title="Forward" @click="goForward">
        <i-material-symbols:arrow-forward-ios-rounded />
      </button>
    </div>

    <div class="tabs-row">
    <div
      v-for="tab in mainStore.tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: tab.id === mainStore.activeTabId }"
      @click="activateTab(tab)"
    >
      <span class="tab-title">{{ tab.title }}</span>
      <button v-if="tab.closeable" class="tab-close" @click.stop="closeTab(tab.id)">
        <i-material-symbols:close-small-rounded />
      </button>
    </div>
    </div>

    <div class="tab-spacer" @dblclick="toggleWindowMaximize" />

    <div class="right-controls">
      <button class="bar-btn" title="Refresh" @click="refreshPage">
        <i-material-symbols:refresh-rounded />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMainStore } from '@/stores/main'
import type { AppTab } from '@/stores/main'
import i18n from '@/plugins/i18n'

const router = useRouter()
const route = useRoute()
const mainStore = useMainStore()

onMounted(() => {
  window.addEventListener('tauri-open-tab', handleOpenTab)
  // Sync current route on first mount (e.g. page reload)
  const group = (route.meta?.group as string) || ''
  if (group && group !== 'home') {
    const titleKey = `page_title.${group}`
    const resolved = String((i18n.global as any).t(titleKey))
    mainStore.syncRouteTab(group, resolved !== titleKey ? resolved : group, route.fullPath)
  }
})

onUnmounted(() => {
  window.removeEventListener('tauri-open-tab', handleOpenTab)
})

function activateTab(tab: AppTab) {
  mainStore.setActiveTab(tab.id)
  if (route.fullPath !== tab.path) {
    router.push(tab.path)
  }
}

function closeTab(id: string) {
  const navPath = mainStore.closeTab(id)
  if (navPath != null) {
    router.push(navPath)
  }
}

function handleOpenTab(e: Event) {
  const path = (e as CustomEvent<{ path: string }>).detail.path
  const resolved = router.resolve(path)
  const group = (resolved.meta?.group as string) || ''
  if (group && group !== 'home') {
    const titleKey = `page_title.${group}`
    const title = String((i18n.global as any).t(titleKey))
    mainStore.syncRouteTab(group, title !== titleKey ? title : group, path)
  } else {
    mainStore.openFileTab(path, path)
  }
  router.push(path)
}

function goBack() {
  router.back()
}

function goForward() {
  router.forward()
}

function refreshPage() {
  router.go(0)
}

async function toggleWindowMaximize() {
  if (!__IS_TAURI__) return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().toggleMaximize()
}
</script>

<style lang="scss" scoped>
.tauri-tab-bar {
  flex-shrink: 0;
  height: var(--pl-tauri-tab-bar-height, 38px);
  display: flex;
  align-items: center;
  gap: 2px;
  padding-left: 80px; /* leave room for macOS traffic lights */
  padding-right: 8px;
  background: var(--md-sys-color-surface-container);
  -webkit-app-region: drag;
  user-select: none;
}

.left-controls,
.right-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.tabs-row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.bar-btn {
  -webkit-app-region: no-drag;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;

  &:hover {
    background: var(--md-sys-color-surface-container-high);
    color: var(--md-sys-color-on-surface);
  }
}

.tab-item {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px 0 12px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  max-width: 200px;
  min-width: 80px;
  color: var(--md-sys-color-on-surface-variant);
  transition: background 0.12s;

  &:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  &.active {
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface);
  }
}

.tab-title {
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.tab-close {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: inherit;
  padding: 0;
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.12s, background 0.12s;

  .tab-item:hover & {
    opacity: 0.7;
  }

  &:hover {
    opacity: 1 !important;
    background: var(--md-sys-color-surface-variant);
  }
}

.tab-spacer {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
  min-width: 20px;
}
</style>
