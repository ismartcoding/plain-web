<template>
  <div>
    <!-- Download progress -->
    <div v-if="isDownloading" class="active-section">
      <progress-card :label-html="progressText" :value="status.downloadProgress" />
      <v-outlined-button class="btn-block active-action" :loading="disableLoading" @click="$emit('cancel-download')">
        {{ $t('ai.cancel_download') }}
      </v-outlined-button>
    </div>

    <!-- Loading -->
    <div v-else-if="isLoading" class="loading-row">
      <v-circular-progress indeterminate class="sm" />
      <span>{{ $t('ai.loading_subtitle') }}</span>
    </div>

    <!-- Indexing progress -->
    <div v-else-if="status.isIndexing" class="active-section">
      <p class="active-label">{{ statusText }}</p>
      <progress-card :label-html="indexText" :value="indexProgress" />
      <p class="help-text">{{ subtitle }}</p>
      <v-outlined-button class="btn-block active-action" :loading="cancelIndexLoading" @click="$emit('cancel-index')">
        {{ $t('ai.stop_scan') }}
      </v-outlined-button>
    </div>

    <!-- Ready -->
    <template v-else-if="isReady">
      <div v-if="status.indexedImages === 0" class="active-section">
        <v-filled-button class="btn-block" :loading="startIndexLoading" @click="$emit('start-index', false)">{{ $t('ai.start_index') }}</v-filled-button>
      </div>
      <div v-else class="surface-card active-data-row">
        <span>{{ $t('ai.indexed_count', { count: status.indexedImages }) }}</span>
        <v-outlined-button class="btn-sm" :loading="startIndexLoading" @click="$emit('start-index', true)">{{ $t('ai.rescan') }}</v-outlined-button>
      </div>
      <danger-action
        class="active-danger-card"
        :label="$t('ai.unload_model')"
        :confirm-text="$t('ai.confirm_delete')"
        :loading="disableLoading"
        @confirm="$emit('delete')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IImageSearchStatus } from '@/lib/interfaces'

const props = defineProps<{
  status: IImageSearchStatus
  indexProgress: number
  startIndexLoading?: boolean
  cancelIndexLoading?: boolean
  disableLoading?: boolean
}>()
defineEmits<{ 'start-index': [force: boolean]; 'cancel-index': []; 'cancel-download': []; delete: [] }>()

const { t } = useI18n()
const isDownloading = computed(() => props.status.status === 'DOWNLOADING')
const isLoading = computed(() => props.status.status === 'LOADING')
const isReady = computed(() => props.status.status === 'READY')

const statusText = computed(() => {
  if (props.status.isIndexing) return t('ai.scanning_title')
  return t('ai.running_title')
})
const subtitle = computed(() => {
  if (props.status.isIndexing) return t('ai.scanning_subtitle')
  return t('ai.ready_subtitle')
})
const progressText = computed(() => {
  const loaded = ((props.status.downloadProgress / 100) * props.status.modelSize / 1e6).toFixed(1)
  const total = (props.status.modelSize / 1e6).toFixed(1)
  return `${t('ai.model_file')} <b>${loaded}</b> / <b>${total} MB</b>`
})
const indexText = computed(() =>
  `${t('ai.indexing_label')} <b>${props.status.indexedImages}</b> / <b>${props.status.totalImages}</b>`
)
</script>

<style lang="scss" scoped>
.active-label { font-size: 0.8rem; font-weight: 500; color: var(--md-sys-color-on-surface); margin: 0 0 8px; }
.active-data-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.875rem; margin-bottom: 16px;
}
.active-danger-card { margin-top: 16px; }
.active-action { margin-top: 12px; }
</style>

