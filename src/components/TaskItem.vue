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
import type { IUploadItem } from '@/stores/temp'
import {
  canPauseItem as canPause, canResumeItem as canResume, canRetryItem as canRetry, isPausingItem as isPausing,
  showProgress, getProgressPercentage, formatUploadSpeed,
  pauseItem, resumeItem, retryItem, removeItem, removeItemFromStore,
} from '@/hooks/upload-task'

const props = defineProps<{
  item: IUploadItem
}>()

function pauseTask(item: IUploadItem) { pauseItem(item) }
function resumeTask(item: IUploadItem) { resumeItem(item) }
function retryTask(item: IUploadItem) { retryItem(item) }
function removeTask(item: IUploadItem) { removeItem(item); removeItemFromStore(item) }
</script>

<style scoped lang="scss">
@use '@/styles/task-item.scss' as *;
</style>
