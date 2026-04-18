<template>
  <v-dropdown v-model="open" :max-height="500">
    <template #trigger>
      <v-icon-button :aria-label="$t('settings')">
        <i-lucide:settings-2  />
      </v-icon-button>
    </template>

    <div v-if="app?.battery != null" class="top-app-bar">
      <div class="title">{{ app.deviceName || $t('my_phone') }}</div>
      <div class="actions">
        <svg class="popup-battery-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="6.5" width="18" height="11" rx="2" ry="2" />
          <line x1="23" y1="10" x2="23" y2="14" />
          <rect x="2.5" y="8" :width="14 * (app.battery / 100)" height="8" rx="1" fill="currentColor" stroke="none" />
        </svg>
        <span class="popup-battery-pct">{{ app.battery }}%</span>
      </div>
    </div>

    <div class="dropdown-item" @click="openCustomizeSidebar">
      <i-lucide:layout-list class="feature-icon" />
      <span>{{ $t('customize_sidebar') }}</span>
    </div>

    <div class="dropdown-item" @click="openExcludedDirs">
      <i-lucide:folder-minus class="feature-icon" />
      <span>{{ $t('exclude_directories') }}</span>
    </div>

    <template v-if="popupFeatures.length">
      <div class="popup-divider"></div>
      <router-link
        v-for="feat in popupFeatures"
        :key="feat.id"
        :to="lastRoute(feat.defaultPath, feat.group)"
        class="dropdown-item"
      >
        <component :is="feat.icon" class="feature-icon" />
        <span>{{ $t(feat.titleKey) }}</span>
      </router-link>
    </template>
  </v-dropdown>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTempStore } from '@/stores/temp'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import { pushModal } from '@/components/modal'
import { getAvailableFeatures, type Feature } from './features'
import RailFeaturesModal from './RailFeaturesModal.vue'
import ExcludedDirsModal from './ExcludedDirsModal.vue'

const { app } = storeToRefs(useTempStore())
const store = useMainStore()
const router = useRouter()
const open = ref(false)

const popupFeatures = computed<Feature[]>(() => {
  const available = getAvailableFeatures(app.value?.channel ?? '')
  return available.filter((f) => !store.railFeatures.includes(f.id))
})

function openCustomizeSidebar() {
  open.value = false
  pushModal(RailFeaturesModal)
}

function openExcludedDirs() {
  open.value = false
  pushModal(ExcludedDirsModal)
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
</script>

<style lang="scss" scoped>
.top-app-bar {
  width: 300px;
}

.popup-battery-svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--md-sys-color-primary);
}

.popup-battery-pct {
  font-size: 0.8125rem;
}

.popup-divider {
  height: 1px;
  background: var(--md-sys-color-outline-variant);
  margin: 4px 0;
}

</style>

