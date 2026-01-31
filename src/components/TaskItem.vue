<template>
  <div class="item task-item" :class="`item-${item.status}`">
    <div class="title">{{ item.file.name }}</div>
    <div class="subtitle">
      <span class="status" :class="`status-${item.status}`">
        {{ $t(`upload_status.${item.status}`) }}
      </span>
      <span class="size">{{ formatFileSize(item.file.size) }}</span>
      <div class="icon task-actions">
        <!-- Pause button -->
        <button v-if="canPause(item)" v-tooltip="$t('pause')" class="btn-icon pause-btn" @click="() => pauseTask(props.item)">
          <i-material-symbols:pause-rounded />
        </button>

        <!-- Pausing button -->
        <button v-if="isPausing(item)" v-tooltip="$t('pausing')" class="btn-icon pausing-btn" disabled>
          <v-circular-progress indeterminate class="sm"/>
        </button>

        <!-- Resume button -->
        <button v-if="canResume(item)" v-tooltip="$t('resume')" class="btn-icon resume-btn" @click="() => resumeTask(props.item)">
          <i-material-symbols:play-arrow-rounded />
        </button>

        <!-- Retry button -->
        <button v-if="canRetry(item)" v-tooltip="$t('retry')" class="btn-icon retry-btn" @click="() => retryTask(props.item)">
          <i-material-symbols:refresh-rounded />
        </button>

        <!-- Cancel/Remove button -->
        <button v-tooltip="$t('remove')" class="btn-icon remove-btn" @click="() => removeTask(props.item)">
          <i-material-symbols:close-rounded />
        </button>
      </div>
    </div>
    <div v-if="showProgress(item) || item.error" class="body">
      <div v-if="showProgress(item)" class="progress-info">
        <div class="progress-text">{{ formatFileSize(item.uploadedSize) }} ({{ formatUploadSpeed(item) }})</div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: getProgressPercentage(item) + '%' }"></div>
        </div>
      </div>
      <div v-if="item.error" class="error-message">
        {{ item.error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatFileSize } from '@/lib/format'
import { pauseUpload, resumeUpload, retryUpload, removeUpload } from '@/lib/upload/upload-queue'
import { useTempStore } from '@/stores/temp'
import type { IUploadItem } from '@/stores/temp'
import { nextTick } from 'vue'

const props = defineProps<{
  item: IUploadItem
}>()

const tempStore = useTempStore()

function showProgress(item: IUploadItem) {
  return ['uploading', 'pending', 'saving'].includes(item.status) && item.uploadedSize > 0
}

function getProgressPercentage(item: IUploadItem) {
  if (item.file.size === 0) return 0
  return Math.round((item.uploadedSize / item.file.size) * 100)
}

function formatUploadSpeed(item: IUploadItem): string {
  if (!item.uploadSpeed || item.uploadSpeed <= 0) {
    return '0 B/s'
  }
  return formatFileSize(item.uploadSpeed) + '/s'
}

// Task action helpers
function canPause(item: IUploadItem) {
  return ['uploading', 'pending'].includes(item.status) && !item.pausing
}

function canResume(item: IUploadItem) {
  return item.status === 'paused' && !item.pausing
}

function canRetry(item: IUploadItem) {
  return item.status === 'error'
}

function isPausing(item: IUploadItem) {
  return item.pausing === true
}

// Task actions with better error handling
async function pauseTask(item: IUploadItem) {
  console.log(`pauseTask: Attempting to pause ${item.id}, current status: ${item.status}`)

  try {
    item.pausing = true
    await nextTick() // Ensure DOM updates immediately

    // Immediately abort xhr if exists
    if (item.xhr) {
      console.log(`pauseTask: Immediately aborting xhr for ${item.id}`)
      try {
        item.xhr.abort()
      } catch (error) {
        console.warn(`pauseTask: Error aborting xhr:`, error)
      }
    }

    // Set status to paused immediately
    item.status = 'paused'

    // Call queue pause
    const success = pauseUpload(item.id)
    console.log(`pauseTask: Queue pause result for ${item.id}:`, success)

    if (!success) {
      console.warn(`pauseTask: Failed to pause ${item.id} in queue, but status already set to paused`)
    }

    // Clear pausing state after a short delay to allow cleanup
    setTimeout(() => {
      item.pausing = false
    }, 1000)
  } catch (error) {
    console.error('Error in pauseTask:', error)
    item.pausing = false
  }
}

function resumeTask(item: IUploadItem) {
  try {
    const success = resumeUpload(item.id)
    if (success) {
      item.status = 'uploading'
    }
  } catch (error) {
    console.error('Error in resumeTask:', error)
  }
}

function retryTask(item: IUploadItem) {
  try {
    const success = retryUpload(item.id)
    if (success) {
      item.status = 'uploading'
      item.error = ''
      item.uploadedSize = 0
      item.uploadSpeed = 0
      item.lastUploadedSize = 0
      item.lastUpdateTime = undefined
    }
  } catch (error) {
    console.error('Error in retryTask:', error)
  }
}

function removeTask(item: IUploadItem) {
  try {
    // Remove from queue if it's managed by queue
    removeUpload(item.id)

    // Remove from store
    const index = tempStore.uploads.indexOf(item)
    if (index > -1) {
      tempStore.uploads.splice(index, 1)
    }

    // Cancel if still uploading
    if (item.xhr) {
      item.xhr.abort()
    }

    item.status = 'canceled'
  } catch (error) {
    console.error('Error in removeTask:', error)
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/task-item.scss' as *;
</style>
