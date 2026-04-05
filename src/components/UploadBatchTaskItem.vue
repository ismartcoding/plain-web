<template>
  <div class="item task-item" :class="`item-${batchStatus}`">
    <div class="title">{{ title }}</div>
    <div class="subtitle">
      <span class="status" :class="`status-${batchStatus}`">
        {{ $t(`upload_status.${batchStatus}`) }}
      </span>
      <span class="size">{{ formatFileSize(totalBytes) }}</span>
      <span class="count">{{ uploads.length }} {{ $t('files') }}</span>

      <div class="icon task-actions">
        <v-icon-button v-if="canPause" v-tooltip="$t('pause')" class="pause-btn" @click="pauseBatch">
          <i-material-symbols:pause-rounded />
        </v-icon-button>
        <v-icon-button v-if="isPausing" v-tooltip="$t('pausing')" :loading="true" class="pausing-btn" />
        <v-icon-button v-if="canResume" v-tooltip="$t('resume')" class="resume-btn" @click="resumeBatch">
          <i-material-symbols:play-arrow-rounded />
        </v-icon-button>
        <v-icon-button v-if="canRetry" v-tooltip="$t('retry')" class="retry-btn" @click="retryBatch">
          <i-material-symbols:refresh-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('remove')" class="remove-btn" @click="removeBatch">
          <i-material-symbols:close-rounded />
        </v-icon-button>
      </div>
    </div>

    <div v-if="showProgress || errorCount > 0" class="body">
      <div v-if="showProgress" class="progress-info">
        <div class="progress-text">
          {{ formatFileSize(uploadedBytes) }} / {{ formatFileSize(totalBytes) }} ({{ formatFileSize(totalSpeed) }}/s)
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <div v-if="errorCount > 0" class="error-message">
        <span v-if="errorCount === 1">{{ firstError }}</span>
        <span v-else>{{ firstError }} (+{{ errorCount - 1 }})</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatFileSize } from '@/lib/format'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import {
  canPauseItem, canResumeItem, canRetryItem, isPausingItem,
  pauseItem, resumeItem, retryItem, removeItem,
} from '@/hooks/upload-task'

const props = defineProps<{
  batchId: string
  uploads: IUploadItem[]
}>()

const tempStore = useTempStore()
const { t } = useI18n()

const title = computed(() => `${t('upload')} (${props.uploads.length} ${t('files')})`)
const totalBytes = computed(() => props.uploads.reduce((acc, it) => acc + (it.file?.size || 0), 0))
const uploadedBytes = computed(() => props.uploads.reduce((acc, it) => acc + (it.uploadedSize || 0), 0))
const totalSpeed = computed(() => props.uploads.reduce((acc, it) => acc + (it.uploadSpeed || 0), 0))
const errorCount = computed(() => props.uploads.filter((it) => it.status === 'error').length)
const firstError = computed(() => props.uploads.find((it) => it.status === 'error')?.error || '')

const batchStatus = computed(() => {
  const statuses = props.uploads.map((u) => u.status)
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('uploading')) return 'uploading'
  if (statuses.includes('saving')) return 'saving'
  if (statuses.includes('pending')) return 'pending'
  if (statuses.every((s) => s === 'paused')) return 'paused'
  if (statuses.length > 0 && statuses.every((s) => s === 'done' || s === 'canceled')) return 'done'
  return 'created'
})

const showProgress = computed(() => ['uploading', 'pending', 'saving'].includes(String(batchStatus.value)) && uploadedBytes.value > 0)
const progressPercent = computed(() => (totalBytes.value <= 0 ? 0 : Math.round((uploadedBytes.value / totalBytes.value) * 100)))
const canPause = computed(() => props.uploads.some((it) => canPauseItem(it)))
const canResume = computed(() => props.uploads.some((it) => canResumeItem(it)))
const canRetry = computed(() => props.uploads.some((it) => canRetryItem(it)))
const isPausing = computed(() => props.uploads.some((it) => isPausingItem(it)))

async function pauseBatch() {
  for (const item of props.uploads) {
    if (canPauseItem(item)) await pauseItem(item)
  }
}

function resumeBatch() {
  for (const item of props.uploads) {
    if (canResumeItem(item)) resumeItem(item)
  }
}

function retryBatch() {
  for (const item of props.uploads) {
    if (canRetryItem(item)) retryItem(item)
  }
}

function removeBatch() {
  for (const item of props.uploads) removeItem(item)
  for (let i = tempStore.uploads.length - 1; i >= 0; i--) {
    if ((tempStore.uploads[i].batchId || tempStore.uploads[i].id) === props.batchId) {
      tempStore.uploads.splice(i, 1)
    }
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/task-item.scss' as *;
</style>
