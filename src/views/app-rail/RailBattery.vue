<template>
  <div v-if="app?.battery" class="rail-battery" @mouseenter="hover = true" @mouseleave="hover = false">
    <svg class="battery-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="6.5" width="18" height="11" rx="2" ry="2" />
      <line x1="23" y1="10" x2="23" y2="14" />
      <rect x="2.5" y="8" :width="14 * (app.battery / 100)" height="8" rx="1" fill="currentColor" stroke="none" />
    </svg>
    <div class="rail-label">{{ app.battery }}%</div>
    <div v-if="hover" class="battery-popup">
      <div class="battery-popup-device">{{ app.deviceName || $t('my_phone') }}</div>
      <router-link :to="lastRoute('/docs', 'docs')" class="battery-popup-feature">
        <i-lucide:file-text class="feature-icon" />
        <span>{{ $t('page_title.docs') }}</span>
      </router-link>
      <router-link v-if="app.channel !== 'GOOGLE'" :to="lastRoute('/apps', 'apps')" class="battery-popup-feature">
        <i-lucide:layout-grid class="feature-icon" />
        <span>{{ $t('page_title.apps') }}</span>
      </router-link>
      <router-link :to="lastRoute('/notes', 'notes')" class="battery-popup-feature">
        <i-lucide:notebook-pen class="feature-icon" />
        <span>{{ $t('page_title.notes') }}</span>
      </router-link>
      <router-link :to="lastRoute('/feeds', 'feeds')" class="battery-popup-feature">
        <i-lucide:rss class="feature-icon" />
        <span>{{ $t('page_title.feeds') }}</span>
      </router-link>
      <router-link v-if="app.channel !== 'GOOGLE'" :to="lastRoute('/messages', 'messages')" class="battery-popup-feature">
        <i-lucide:message-square-text class="feature-icon" />
        <span>{{ $t('page_title.messages') }}</span>
      </router-link>
      <router-link v-if="app.channel !== 'GOOGLE'" :to="lastRoute('/calls', 'calls')" class="battery-popup-feature">
        <i-material-symbols:call-log-outline-rounded class="feature-icon" />
        <span>{{ $t('page_title.calls') }}</span>
      </router-link>
      <router-link :to="lastRoute('/contacts', 'contacts')" class="battery-popup-feature">
        <i-lucide:contact-round class="feature-icon" />
        <span>{{ $t('page_title.contacts') }}</span>
      </router-link>
      <router-link :to="lastRoute('/screen-mirror', 'screen_mirror')" class="battery-popup-feature">
        <i-material-symbols:screen-record-rounded class="feature-icon" />
        <span>{{ $t('page_title.screen_mirror') }}</span>
      </router-link>
      <router-link :to="lastRoute('/device-info', 'device_info')" class="battery-popup-feature">
        <i-lucide:smartphone class="feature-icon" />
        <span>{{ $t('device_info') }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'

const { app } = storeToRefs(useTempStore())
const store = useMainStore()
const router = useRouter()
const hover = ref(false)

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
.rail-battery {
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 0;
  color: var(--md-sys-color-on-surface-variant);
  position: relative;
  cursor: default;
}

.battery-svg {
  width: 24px;
  height: 24px;
}

.rail-label {
  font-size: 12px;
  line-height: 1;
  text-align: center;
}

.battery-popup {
  position: absolute;
  left: 56px;
  bottom: 0;
  background: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  padding: 12px;
  min-width: 180px;
  max-width: 240px;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.battery-popup-device {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.battery-popup-feature {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: var(--md-sys-color-on-surface-variant);
  padding: 5px 0;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    color: var(--md-sys-color-primary);
  }

  .feature-icon {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }
}
</style>
