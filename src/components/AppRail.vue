<template>
  <nav class="app-rail">
    <router-link to="/" class="rail-brand" aria-label="PlainBox home">
      <span class="brand-logo" aria-hidden="true"></span>
    </router-link>

    <router-link
      v-tooltip="$t('page_title.files')"
      :to="lastRoute('/files/recent', 'files')"
      class="rail-item"
      :class="{ active: isActive('/files') }"
      aria-label="Files"
    >
      <i-lucide:folder />
      <div class="rail-label">{{ $t('page_title.files') }}</div>
    </router-link>

    <router-link
      v-tooltip="$t('page_title.audios')"
      :to="lastRoute('/audios', 'audios')"
      class="rail-item"
      :class="{ active: isActive('/audios') }"
      aria-label="Audios"
    >
      <i-lucide:music />
      <div class="rail-label">{{ $t('page_title.audios') }}</div>
    </router-link>

    <router-link
      v-tooltip="$t('page_title.images')"
      :to="lastRoute('/images', 'images')"
      class="rail-item"
      :class="{ active: isActive('/images') }"
      aria-label="Images"
    >
      <i-lucide:image />
      <div class="rail-label">{{ $t('page_title.images') }}</div>
    </router-link>

    <router-link
      v-tooltip="$t('page_title.videos')"
      :to="lastRoute('/videos', 'videos')"
      class="rail-item"
      :class="{ active: isActive('/videos') }"
      aria-label="Videos"
    >
      <i-lucide:video />
      <div class="rail-label">{{ $t('page_title.videos') }}</div>
    </router-link>

    <router-link
      v-tooltip="$t('page_title.chat')"
      :to="lastRoute('/chat', 'chat')"
      class="rail-item"
      :class="{ active: isActive('/chat') }"
      aria-label="Chat"
    >
      <i-lucide:bot />
      <div class="rail-label">{{ $t('page_title.chat') }}</div>
    </router-link>

    <div class="rail-spacer"></div>

    <div v-if="app?.battery" v-tooltip="$t('battery_left', { percentage: app.battery })" class="rail-battery">
      <svg class="battery-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="6.5" width="18" height="11" rx="2" ry="2" />
        <line x1="23" y1="10" x2="23" y2="14" />
        <rect x="2.5" y="8" :width="14 * (app.battery / 100)" height="8" rx="1" fill="currentColor" stroke="none" />
      </svg>
      <div class="rail-label">{{ app.battery }}%</div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'

const { app } = storeToRefs(useTempStore())

const store = useMainStore()
const router = useRouter()

function isActive(prefix: string) {
  try {
    const path = router.currentRoute.value.path
    if (prefix === '/') return path === '/'
    return path.startsWith(prefix)
  } catch {
    return false
  }
}

function lastRoute(defaultPath: string, group: string) {
  try {
    const saved = store.lastRoutes[group]
    if (!saved) return defaultPath
    const resolved = router.resolve(saved)
    const g = (resolved.meta?.group || '') as string
    return g === group ? saved : defaultPath
  } catch {
    return defaultPath
  }
}

// Persist last visited route per group into MainState
const removeAfterEach = router.afterEach((to) => {
  const group = (to.meta?.group || '') as string
  if (group) {
    store.lastRoutes[group] = to.fullPath
  }
})

onBeforeUnmount(() => {
  removeAfterEach()
})
</script>

<style lang="scss" scoped>
.app-rail {
  grid-area: rail;
  width: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.rail-brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  width: 40px;
  height: 40px;
  margin: 4px 0 10px;
  color: var(--md-sys-color-on-surface-variant);
}

.rail-brand:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
}

.app-rail .brand-logo {
  width: 40px;
  height: 40px;
  display: block;
  background-image: url('/logo.svg');
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}

.rail-item {
  width: 56px;
  height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--md-sys-color-on-surface-variant);
  margin: 6px 0;
  gap: 4px;
  text-decoration: none;
}

.rail-item svg {
  width: 22px;
  height: 22px;
}

.rail-label {
  font-size: 12px;
  line-height: 1;
  text-align: center;
}

.rail-item:hover,
.rail-item.active {
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
  color: var(--md-sys-color-primary);
}

.rail-spacer {
  flex: 1;
}

.rail-battery {
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 0;
  color: var(--md-sys-color-on-surface-variant);
}

.battery-svg {
  width: 24px;
  height: 24px;
}
</style>
