<template>
  <div class="rail-settings" @mouseenter="hover = true" @mouseleave="hover = false">
    <button class="settings-btn" :aria-label="$t('settings')" @click="open">
      <i-lucide:settings-2 class="settings-icon" />
    </button>

    <div v-if="hover" class="settings-popup">
      <div v-if="app?.battery != null" class="popup-device">
        <div class="popup-device-name">{{ app.deviceName || $t('my_phone') }}</div>
        <div class="popup-battery-row">
          <svg class="popup-battery-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="6.5" width="18" height="11" rx="2" ry="2" />
            <line x1="23" y1="10" x2="23" y2="14" />
            <rect x="2.5" y="8" :width="14 * (app.battery / 100)" height="8" rx="1" fill="currentColor" stroke="none" />
          </svg>
          <span class="popup-battery-pct">{{ app.battery }}%</span>
        </div>
      </div>

      <div class="popup-divider"></div>

      <button class="popup-action" @click="openFeaturesModal">
        <i-lucide:layout-dashboard class="feature-icon" />
        <span>{{ $t('customize_sidebar') }}</span>
      </button>
<!-- 
      <router-link to="/settings" class="popup-action">
        <i-lucide:settings-2 class="feature-icon" />
        <span>{{ $t('settings') }}</span>
      </router-link> -->

      <template v-if="popupFeatures.length">
        <div class="popup-divider"></div>
        <router-link
          v-for="feat in popupFeatures"
          :key="feat.id"
          :to="lastRoute(feat.defaultPath, feat.group)"
          class="popup-action"
        >
          <component :is="feat.icon" class="feature-icon" />
          <span>{{ $t(feat.titleKey) }}</span>
        </router-link>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { getAvailableFeatures, type Feature } from './features'
import { pushModal } from '@/components/modal'
import RailFeaturesModal from './RailFeaturesModal.vue'

const { app } = storeToRefs(useTempStore())
const store = useMainStore()
const router = useRouter()
const hover = ref(false)

const popupFeatures = computed<Feature[]>(() => {
  const available = getAvailableFeatures(app.value?.channel ?? '')
  return available.filter((f) => !store.railFeatures.includes(f.id))
})

function open() {
  hover.value = true
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

function openFeaturesModal() {
  hover.value = false
  pushModal(markRaw(RailFeaturesModal))
}
</script>

<style lang="scss" scoped>
.rail-settings {
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0 8px;
  position: relative;
}

.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
    color: var(--md-sys-color-primary);
  }
}

.settings-icon {
  width: 20px;
  height: 20px;
}

.settings-popup {
  position: absolute;
  left: 60px;
  bottom: 0;
  background: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  padding: 8px;
  min-width: 200px;
  max-width: 260px;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.popup-device {
  padding: 6px 8px 8px;
}

.popup-device-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.popup-battery-row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--md-sys-color-on-surface-variant);
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

.popup-action {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
  padding: 8px;
  border-radius: 8px;
  text-decoration: none;
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  white-space: nowrap;

  &:hover {
    color: var(--md-sys-color-primary);
    background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
  }

  .feature-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
}
</style>
