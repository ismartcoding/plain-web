<template>
  <section class="info">
    <div class="info-header">
      <div class="info-title">
        <span>{{ $t('info') }}</span>
        <lightbox-keyboard-shortcuts class="info-keyboard-shortcuts" />
      </div>
      <div class="info-actions">
        <template v-if="canTrash">
          <template v-if="isTrashed">
            <v-outlined-button class="info-btn" @click.stop="$emit('delete-file')">
              <i-material-symbols:delete-forever-outline-rounded />
              {{ $t('delete') }}
            </v-outlined-button>
            <v-outlined-button class="info-btn" :class="{ loading: restoreLoading(`ids:${current?.data?.id}`) }" @click.stop="restoreItem">
              <i-material-symbols:restore-from-trash-outline-rounded />
              {{ $t('restore') }}
            </v-outlined-button>
          </template>
          <template v-else>
            <v-outlined-button class="info-btn" :class="{ loading: trashLoading(`ids:${current?.data?.id}`) }" @click.stop="trashMediaItem">
              <i-material-symbols:delete-outline-rounded />
              {{ $t('move_to_trash') }}
            </v-outlined-button>
            <v-outlined-button class="info-btn" @click.stop="$emit('rename-file')">
              <i-material-symbols:edit-outline-rounded />
              {{ $t('rename') }}
            </v-outlined-button>
          </template>
        </template>
        <template v-else>
          <v-outlined-button class="info-btn" @click.stop="$emit('delete-file')">
            <i-material-symbols:delete-forever-outline-rounded />
            {{ $t('delete') }}
          </v-outlined-button>
          <v-outlined-button class="info-btn" @click.stop="$emit('rename-file')">
            <i-material-symbols:edit-outline-rounded />
            {{ $t('rename') }}
          </v-outlined-button>
        </template>
        <v-outlined-button class="info-btn download-btn" @click.stop="handleDownload">
          <i-material-symbols:download-rounded />
          {{ $t('download') }}
        </v-outlined-button>
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
          <v-icon-button v-tooltip="$t('add_to_tags')" class="info-tag-btn" @click.prevent="$emit('add-to-tags')">
            <i-material-symbols:label-outline-rounded />
          </v-icon-button>
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
  name?: string
  path?: string
  src?: string
  type?: string
  size?: number
  duration?: number
  viewOriginImage?: boolean
  data?: any
}

const props = defineProps({
  current: {
    type: Object as () => ISource | undefined,
    required: true,
  },
  fileInfo: {
    type: Object,
    default: null,
  },
  urlTokenKey: {
    type: String,
    required: true,
  },
  externalFilesDir: {
    type: String,
    default: '',
  },
  tagsMap: {
    type: Object as () => Map<string, ITag[]>,
    required: true,
  },
  osVersion: {
    type: Number,
    default: 0,
  },
  downloadFile: {
    type: Function,
    required: true,
  },
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
  width: 350px;
  height: 100vh;
  box-sizing: border-box;
  background: var(--md-sys-color-surface-container);
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.info-header {
  padding: 16px;
}

.info-title {
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 16px;
  span {
    font-size: 1.2rem;
    font-weight: bold;
  }
}

.info-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: auto auto;
  gap: 8px;
}

.download-btn {
  grid-column: 1 / span 2;
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
  margin-left: 4px;
  cursor: pointer;
  display: inline-flex;
  color: var(--md-sys-color-primary);
}
.info-keyboard-shortcuts {
  margin-inline-start: auto;
}
</style>
