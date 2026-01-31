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
        <button v-if="canPause" v-tooltip="$t('pause')" class="btn-icon pause-btn" @click="pauseBatch">
          <i-material-symbols:pause-rounded />
        </button>

        <button v-if="isPausing" v-tooltip="$t('pausing')" class="btn-icon pausing-btn" disabled>
          <v-circular-progress indeterminate class="sm" />
        </button>

        <button v-if="canResume" v-tooltip="$t('resume')" class="btn-icon resume-btn" @click="resumeBatch">
          <i-material-symbols:play-arrow-rounded />
        </button>

        <button v-if="canRetry" v-tooltip="$t('retry')" class="btn-icon retry-btn" @click="retryBatch">
          <i-material-symbols:refresh-rounded />
        </button>

        <button v-tooltip="$t('remove')" class="btn-icon remove-btn" @click="removeBatch">
          <i-material-symbols:close-rounded />
        </button>
      </div>
    </div>

    <div v-if="showProgress || errorCount > 0" class="body">
      <div v-if="showProgress" class="progress-info">
        <div class="progress-text">
          {{ formatFileSize(uploadedBytes) }} / {{ formatFileSize(totalBytes) }} ({{ formatFileSize(totalSpeed) }}/s)
        </div>
        <div class="progress-bar">
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
import { computed, nextTick } from 'vue'
import { formatFileSize } from '@/lib/format'
import { pauseUpload, resumeUpload, retryUpload, removeUpload } from '@/lib/upload/upload-queue'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  batchId: string
  uploads: IUploadItem[]
}>()

const tempStore = useTempStore()
const { t } = useI18n()

function keyOf(it: IUploadItem) {
  return it.batchId || it.id
}

const title = computed(() => {
  return `${t('upload')} (${props.uploads.length} ${t('files')})`
})

const totalBytes = computed(() => props.uploads.reduce((acc, it) => acc + (it.file?.size || 0), 0))
const uploadedBytes = computed(() => props.uploads.reduce((acc, it) => acc + (it.uploadedSize || 0), 0))
const totalSpeed = computed(() => props.uploads.reduce((acc, it) => acc + (it.uploadSpeed || 0), 0))

const errorCount = computed(() => props.uploads.filter((it) => it.status === 'error').length)
const firstError = computed(() => props.uploads.find((it) => it.status === 'error')?.error || '')

const batchStatus = computed(() => {
  const statuses = props.uploads.map((u) => u.status)
  const completedStates = new Set(['done', 'canceled'])
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('uploading')) return 'uploading'
  if (statuses.includes('saving')) return 'saving'
  if (statuses.includes('pending')) return 'pending'
  if (statuses.every((s) => s === 'paused')) return 'paused'
  if (statuses.length > 0 && statuses.every((s) => completedStates.has(s))) return 'done'
  return 'created'
})

const showProgress = computed(() => {
  return ['uploading', 'pending', 'saving'].includes(String(batchStatus.value)) && uploadedBytes.value > 0
})

const progressPercent = computed(() => {
  if (totalBytes.value <= 0) return 0
  return Math.round((uploadedBytes.value / totalBytes.value) * 100)
})

const canPause = computed(() => props.uploads.some((it) => ['uploading', 'pending'].includes(it.status) && !it.pausing))
const canResume = computed(() => props.uploads.some((it) => it.status === 'paused' && !it.pausing))
const canRetry = computed(() => props.uploads.some((it) => it.status === 'error'))
const isPausing = computed(() => props.uploads.some((it) => it.pausing === true))

async function pauseBatch() {
  for (const item of props.uploads) {
    if (!['uploading', 'pending'].includes(item.status) || item.pausing) continue
    item.pausing = true
  }
  await nextTick()

  for (const item of props.uploads) {
    if (!item.pausing) continue
    if (item.xhr) {
      try {
        item.xhr.abort()
      } catch {
        // ignore
      }
    }
    item.status = 'paused'
    pauseUpload(item.id)
    setTimeout(() => {
      item.pausing = false
    }, 1000)
  }
}

function resumeBatch() {
  for (const item of props.uploads) {
    if (item.status !== 'paused' || item.pausing) continue
    const ok = resumeUpload(item.id)
    if (ok) item.status = 'uploading'
  }
}

function retryBatch() {
  for (const item of props.uploads) {
    if (item.status !== 'error') continue
    const ok = retryUpload(item.id)
    if (!ok) continue
    item.status = 'uploading'
    item.error = ''
    item.uploadedSize = 0
    item.uploadSpeed = 0
    item.lastUploadedSize = 0
    item.lastUpdateTime = undefined
  }
}

function removeBatch() {
  for (const item of props.uploads) {
    removeUpload(item.id)
    if (item.xhr) {
      try {
        item.xhr.abort()
      } catch {
        // ignore
      }
    }
    item.status = 'canceled'
  }

  for (let i = tempStore.uploads.length - 1; i >= 0; i--) {
    const it = tempStore.uploads[i]
    if (keyOf(it) === props.batchId) {
      tempStore.uploads.splice(i, 1)
    }
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/task-item.scss' as *;
</style>
