<template>
  <div class="browser" :style="browserStyle">
    <aside class="browser-sidebar">
      <div v-if="loadingMounts" class="volumes-loading">
        <v-circular-progress indeterminate class="sm" />
      </div>
      <div v-else class="browser-volumes">
        <VolumeCard
          v-for="v in sortedVolumes"
          :key="v.id"
          :title="mountTitle(v)"
          :used-percent="mountUsedPercent(v)"
          :count="mountCount(v)"
          :show-progress="Number(v.totalBytes || 0) > 0"
          :data="v"
          :active="String(v.mountPoint || '') === activeRoot"
          @click="emit('selectRoot', v.mountPoint || '/')"
        />
      </div>
    </aside>

    <section class="browser-main">
      <div class="toolbar">
        <v-icon-button v-if="canGoUp" v-tooltip="t('back')" @click.stop="emit('goUp')">
          <i-material-symbols:arrow-back-rounded />
        </v-icon-button>
        <div class="path">{{ currentDir }}</div>
        <slot name="toolbar-actions" />
      </div>

      <div class="list" :class="{ loading: listing }" :style="listStyle">
        <div v-show="listing" class="loading-overlay" aria-live="polite" aria-busy="true">
          <div class="loading-row">
            <v-circular-progress indeterminate class="sm" />
            <span>{{ t('loading') }}</span>
          </div>
        </div>

        <div v-show="!listing && dirItems.length === 0" class="empty-row">{{ t('no_data') }}</div>

        <button
          v-for="d in dirItems"
          :key="d"
          class="dir-row"
          @click="emit('enterDir', d)"
        >
          <span class="dir-icon">
            <i-material-symbols:folder-rounded />
          </span>
          <span class="dir-name">{{ dirName(d) }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import VolumeCard from '@/components/storage/VolumeCard.vue'
import type { IStorageMount } from '@/lib/interfaces'
import { formatFileSize } from '@/lib/format'

const { t } = useI18n()

const props = defineProps<{
  volumes: IStorageMount[]
  loadingMounts?: boolean
  activeRoot: string
  currentDir: string
  canGoUp: boolean
  listing: boolean
  dirItems: string[]
  dirName: (path: string) => string
  browserMinHeightPx?: number
  listMinHeightPx?: number
}>()

const emit = defineEmits<{
  (e: 'selectRoot', mountPoint: string): void
  (e: 'goUp'): void
  (e: 'enterDir', absPath: string): void
}>()

function driveRank(m: IStorageMount) {
  if (m.driveType === 'INTERNAL_STORAGE') return 0
  if (m.driveType === 'SDCARD') return 1
  if (m.driveType === 'USB_STORAGE') return 2
  if (m.driveType === 'APP') return 3
  return 9
}

const sortedVolumes = computed(() =>
  [...props.volumes].sort((a, b) => {
    const da = driveRank(a)
    const db = driveRank(b)
    if (da !== db) return da - db
    return (a.mountPoint || '').localeCompare(b.mountPoint || '')
  })
)

const usbIndexMap = computed(() => {
  const usbPoints = props.volumes
    .filter((m) => m.driveType === 'USB_STORAGE')
    .map((m) => m.mountPoint)
    .filter(Boolean)
  return new Map<string, number>(usbPoints.map((p, i) => [p, i + 1]))
})

function mountTitle(m: IStorageMount): string {
  if (m.driveType === 'INTERNAL_STORAGE') return t('internal_storage')
  if (m.driveType === 'APP') return t('app_data')
  if (m.driveType === 'SDCARD') return t('sdcard')
  if (m.driveType === 'USB_STORAGE') {
    const idx = usbIndexMap.value.get(m.mountPoint) ?? 1
    return `${t('usb_storage')} ${idx}`
  }
  return m.name || m.mountPoint
}

function mountUsedPercent(m: IStorageMount): number {
  const total = Number(m.totalBytes || 0)
  const used = Number(m.usedBytes || 0)
  if (!total) return 0
  const pct = (used / total) * 100
  return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
}

function mountCount(m: IStorageMount): string {
  const free = Number(m.freeBytes || 0)
  const total = Number(m.totalBytes || 0)
  if (!total) return ''
  return t('storage_free_total', { free: formatFileSize(free), total: formatFileSize(total) })
}

const browserStyle = computed(() => {
  const minH = Number(props.browserMinHeightPx ?? 260)
  return minH ? { minHeight: `${minH}px` } : undefined
})

const listStyle = computed(() => {
  const minH = Number(props.listMinHeightPx ?? 160)
  return minH ? { minHeight: `${minH}px` } : undefined
})
</script>

<style scoped>
.browser {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.volumes-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.browser-volumes {
  gap: 8px;
  display: flex;
  flex-direction: column;
}

.browser-sidebar {
  border-radius: 12px;
  max-height: min(280px, 34vh);
  overflow-y: auto;
}

.browser-main {
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 12px;
  background: var(--md-sys-color-surface-container-low);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container-low);
}

.path {
  flex: 1;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list {
  position: relative;
  padding: 8px;
  overflow: auto;
  flex: 1;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--md-sys-color-surface-container-low) 65%, transparent);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

.list.loading .dir-row {
  pointer-events: none;
}

.loading-row,
.empty-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.dir-row {
  width: 100%;
  display: grid;
  grid-template-columns: 28px 1fr;
  align-items: center;
  min-height: 42px;
  border: 0;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  color: var(--md-sys-color-on-surface-variant);
}

.dir-row:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent);
}

.dir-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dir-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--md-sys-color-on-surface);
}

@media (min-width: 980px) {
  .browser {
    flex-direction: row;
    align-items: stretch;
  }

  .browser-sidebar {
    width: 320px;
    max-height: none;
  }

  .browser-main {
    flex: 1;
  }
}
</style>
