<template>
  <section class="info">
    <div class="info-header">
      <h3 class="info-title">{{ $t('info') }}</h3>
      <div class="info-actions">
        <template v-if="canTrash">
          <template v-if="isTrashed">
            <button v-tooltip="$t('delete')" class="info-btn" @click.stop="$emit('delete-file')">
              <i-material-symbols:delete-forever-outline-rounded />
              <span class="info-btn-text">{{ $t('delete') }}</span>
            </button>
            <button v-tooltip="$t('restore')" class="info-btn" :class="{ 'loading': restoreLoading(`ids:${current?.data?.id}`) }" @click.stop="restoreItem">
              <i-material-symbols:restore-from-trash-outline-rounded />
              <span class="info-btn-text">{{ $t('restore') }}</span>
            </button>
          </template>
          <template v-else>
            <button v-tooltip="$t('move_to_trash')" class="info-btn" :class="{ 'loading': trashLoading(`ids:${current?.data?.id}`) }" @click.stop="trashMediaItem">
              <i-material-symbols:delete-outline-rounded />
              <span class="info-btn-text">{{ $t('move_to_trash') }}</span>
            </button>
            <button v-tooltip="$t('rename')" class="info-btn" @click.stop="$emit('rename-file')">
              <i-material-symbols:edit-outline-rounded />
              <span class="info-btn-text">{{ $t('rename') }}</span>
            </button>
          </template>
        </template>
        <template v-else>
          <button v-tooltip="$t('delete')" class="info-btn" @click.stop="$emit('delete-file')">
            <i-material-symbols:delete-forever-outline-rounded />
            <span class="info-btn-text">{{ $t('delete') }}</span>
          </button>
          <button v-tooltip="$t('rename')" class="info-btn" @click.stop="$emit('rename-file')">
            <i-material-symbols:edit-outline-rounded />
            <span class="info-btn-text">{{ $t('rename') }}</span>
          </button>
        </template>
        <button v-tooltip="$t('download')" class="info-btn download-btn" @click.stop="handleDownload">
          <i-material-symbols:download-rounded />
          <span class="info-btn-text">{{ $t('download') }}</span>
        </button>
      </div>
    </div>
    <div class="info-content">
      <div class="info-item">
        <div class="info-item-label">{{ $t('file_size') }}</div>
        <div class="info-item-value">
          {{ formatFileSize(current?.size ?? 0) }}
          <span v-if="fileInfo?.data?.width && fileInfo?.data?.height" class="info-resolution">{{ getResolution() }}</span>
        </div>
      </div>
      <div v-if="fileInfo?.updatedAt" class="info-item">
        <div class="info-item-label">{{ $t('updated_at') }}</div>
        <div class="info-item-value">
          <time v-tooltip="formatDateTimeFull(fileInfo.updatedAt)">{{ formatDateTime(fileInfo.updatedAt) }}</time>
        </div>
      </div>
      <div v-if="current && (isAudio(current?.name || '') || isVideo(current?.name || ''))" class="info-item">
        <div class="info-item-label">{{ $t('duration') }}</div>
        <div class="info-item-value">{{ formatSeconds(fileInfo?.data?.duration ?? current?.duration) }}</div>
      </div>
      <div v-if="current?.type && !isTrashed" class="info-item">
        <div class="info-item-label">
          {{ $t('tags') }}
          <button v-tooltip="$t('add_to_tags')" class="info-tag-btn" @click.prevent="$emit('add-to-tags')">
            <i-material-symbols:label-outline-rounded />
          </button>
        </div>
        <div class="info-item-value"><item-tags :tags="fileInfo?.tags" /></div>
      </div>
      <div v-if="current?.path" class="info-item">
        <div class="info-item-label">{{ $t('path') }}</div>
        <div class="info-item-value info-path">{{ getFinalPath(externalFilesDir, current.path) }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { formatFileSize, formatSeconds } from '@/lib/format'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { isVideo, isImage, isAudio } from '@/lib/file'
import { getFileName, getFinalPath } from '@/lib/api/file'
import type { ITag } from '@/lib/interfaces'
import { DataType, FEATURE } from '@/lib/data'
import { hasFeature } from '@/lib/feature'
import { useMediaRestore, useMediaTrash } from '@/hooks/media-trash'

interface ISource {
  name?: string;
  path?: string;
  src?: string;
  type?: string;
  size?: number;
  duration?: number;
  viewOriginImage?: boolean;
  data?: any;
}

const props = defineProps({
  current: {
    type: Object as () => ISource | undefined,
    required: true
  },
  fileInfo: {
    type: Object,
    default: null
  },
  urlTokenKey: {
    type: String,
    required: true
  },
  externalFilesDir: {
    type: String,
    default: ''
  },
  tagsMap: {
    type: Object as () => Map<string, ITag[]>,
    required: true
  },
  osVersion: {
    type: Number,
    default: 0
  },
  downloadFile: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['rename-file', 'delete-file', 'add-to-tags', 'refetch-info'])

const isTrashed = computed(() => {
  return props.current?.path?.includes('.trashed-') === true
})

const canTrash = computed(() => {
  const mediaTypes = [DataType.VIDEO, DataType.AUDIO, DataType.IMAGE]
  const type = props.current?.type
  return type && mediaTypes.includes(type as DataType) && hasFeature(FEATURE.MEDIA_TRASH, props.osVersion)
})

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Delete' || ((event.ctrlKey || event.metaKey) && event.key === 'Backspace')) {
    event.preventDefault()
    if (canTrash.value && !isTrashed.value) {
      trashMediaItem()
    } else if ((canTrash.value && isTrashed.value) || !canTrash.value) {
      emit('delete-file')
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

function getResolution() {
  const width = props.fileInfo?.data?.width ?? 0
  const height = props.fileInfo?.data?.height ?? 0
  let r = `  ${width} x ${height}`
  if (isImage(props.current?.name ?? '')) {
    const mp = Math.round((width * height) / 1000000)
    if (mp > 1) {
      r += `  ${mp} MP`
    }
  }
  return r
}

function handleDownload() {
  if (props.current?.path) {
    props.downloadFile(props.current.path, getFileName(props.current.path).replace(' ', '-'))
  }
}

const { trash, trashLoading } = useMediaTrash()
function trashMediaItem() {
  if (!props.current?.data?.id || !props.current.type) return
  trash(props.current.type as DataType, `ids:${props.current.data.id}`)
}

const { restore, restoreLoading } = useMediaRestore()
function restoreItem() {
  if (!props.current?.data?.id || !props.current.type) return
  restore(props.current.type as DataType, `ids:${props.current.data.id}`)
}
</script>

<style lang="scss" scoped>
.info {
  grid-area: info;
  width: 320px;
  height: 100vh;
  box-sizing: border-box;
  background: var(--md-sys-color-surface-container);
  overflow-y: auto;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.info-header {
  padding: 16px;
}

.info-title {
  font-size: 1.2rem;
  font-weight: bold;
  margin: 0 0 16px 0;
}

.info-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: auto auto;
  gap: 10px;
}

.info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: transparent;
  border: 1px solid var(--md-sys-color-outline);
  color: var(--md-sys-color-on-surface);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;

  &:hover {
    background-color: var(--md-sys-color-surface-container-highest);
    border-color: var(--md-sys-color-outline-variant);
  }

  &.loading {
    opacity: 0.7;
    pointer-events: none;
  }
}

.download-btn {
  grid-column: 1 / span 2;
}

.info-btn-text {
  white-space: nowrap;
}

.info-content {
  padding: 16px;
}

.info-item {
  margin-bottom: 16px;
}

.info-item-label {
  color: var(--md-sys-color-on-surface-variant);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  font-weight: bold;
}

.info-item-value {
  word-break: break-word;
}

.info-resolution {
  margin-left: 4px;
}

.info-tag-btn {
  background: none;
  border: none;
  padding: 2px;
  margin-left: 4px;
  cursor: pointer;
  display: inline-flex;
  color: var(--md-sys-color-primary);
}

</style> 