<template>
  <div class="file-container">
    <div v-for="(item, i) in items" :key="i" class="file-item-wrapper">
      <div class="file-item" @click="clickItem(item)">
        <div class="file-content">
          <div class="file-name" :class="{ playing: activeAudioSrc === item.src }">{{ item.name }}</div>
          <div class="file-info">
            {{ formatFileSize(item.size) }}{{ item.duration > 0 ? ' / ' + formatSeconds(item.duration) : '' }}
          </div>
          <div v-if="item.summary" class="file-summary">{{ item.summary }}</div>
        </div>
        <div class="thumb-wrap">
          <img v-if="getThumb(item)" :src="getThumb(item)" class="file-thumbnail" :class="{ 'file-icon': !isImage(item.name) && !isVideo(item.name) }" @error="onIconError(item.name)" />
          <ChatDownloadOverlay :download-info="downloadInfo" :ring-size="40" border-radius="8px" />
        </div>
      </div>
      <ChatAudioPlayer v-if="activeAudioSrc === item.src" :src="item.src" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { getFileName, getFileUrl, notId, getFileExtension, getPeerProxyUrl, getFileId } from '@/lib/api/file'
import type { ISource } from '../lightbox/types'
import { isVideo, isImage, isAudio, isTextFile, canOpenInBrowser, isAppFile } from '@/lib/file'
import { formatSeconds, formatFileSize } from '@/lib/format'
import { useTempStore } from '@/stores/temp'
import ChatAudioPlayer from './ChatAudioPlayer.vue'
import ChatDownloadOverlay from './ChatDownloadOverlay.vue'

const props = defineProps({
  data: { type: Object, default: () => ({}) },
  downloadInfo: { type: Object as () => { downloaded: number; total: number; speed: number; status: string } | null, default: null },
  peer: { type: Object as () => { ip: string; port: number } | null, default: null },
})

const tempStore = useTempStore()
const { urlTokenKey } = storeToRefs(tempStore)

const activeAudioSrc = ref<string | null>(null)
const iconErrors = ref<string[]>([])

const items = computed<ISource[]>(() => {
  const files = props.data?._content?.value?.items ?? []
  return (props.data?.data?.ids ?? []).map((id: string, i: number) => {
    const f = files[i]
    return {
      path: f.uri, src: getFileUrl(id),
      viewOriginImage: notId(id) || f.uri.endsWith('.gif'),
      name: getFileName(f.fileName ?? f.uri), duration: f.duration, size: f.size,
      fileId: id, thumbnail: f.thumbnail, extension: getFileExtension(f.uri),
      summary: f.summary || undefined, isFromChat: true,
    }
  })
})

const ACTIVE_STATUSES = ['pending', 'downloading', 'paused', 'failed']
const isActiveDl = computed(
  () => !!props.downloadInfo && ACTIVE_STATUSES.includes(props.downloadInfo.status),
)

function getThumb(item: ISource) {
  if (isImage(item.name) || isVideo(item.name)) {
    if (item.thumbnail) return item.thumbnail
    // During active download the file doesn't exist yet — use peer proxy if available
    if (isActiveDl.value) {
      if (props.peer && item.path.startsWith('fsid:')) {
        return getPeerProxyUrl(tempStore.urlTokenKey, props.peer, item.path.slice(4), '&w=50&h=50')
      }
      return ''
    }
    return item.src.startsWith('blob:') ? item.src : `${item.src}&w=50&h=50`
  }
  const ext = item.extension
  if (ext && !iconErrors.value.includes(item.name)) return `/ficons/${ext}.svg`
  return '/ficons/default.svg'
}

function onIconError(name: string) {
  if (!iconErrors.value.includes(name)) iconErrors.value.push(name)
}

function clickItem(item: ISource) {
  if (isAudio(item.name)) {
    activeAudioSrc.value = activeAudioSrc.value === item.src ? null : item.src
    return
  }
  if (isTextFile(item.name) && item.fileId) {
    let textFileId = item.fileId
    if (isAppFile(item.path) && urlTokenKey.value) {
      textFileId = getFileId(urlTokenKey.value, JSON.stringify({ path: item.path, name: item.name }))
    }
    window.open(`/text-file?id=${encodeURIComponent(textFileId)}`, '_blank')
  } else if (canOpenInBrowser(item.name)) {
    window.open(item.src, '_blank')
  } else if (isImage(item.name) || isVideo(item.name)) {
    const viewable = items.value.filter((it) => isImage(it.name) || isVideo(it.name))
    tempStore.lightbox = { sources: viewable, index: viewable.findIndex((it) => it.src === item.src), visible: true }
  } else {
    window.open(item.src, '_blank')
  }
}
</script>

<style lang="scss" scoped>
.file-container {
  margin-top: 6px;
  max-width: 600px;
}

.file-item-wrapper {
  margin-bottom: 6px;
  background: var(--md-sys-color-surface-container);
  border-radius: 12px;
  overflow: hidden;
  &:last-child { margin-bottom: 0; }
}

.file-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: var(--md-sys-color-surface-container-high); }
}

.file-content {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  word-break: break-all;
  margin-bottom: 4px;
  &.playing { color: var(--md-sys-color-on-surface-variant); }
}

.file-info {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
}

.file-summary {
  font-size: 0.8rem;
  color: var(--md-sys-color-on-surface-variant);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.file-thumbnail {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  display: block;
}

.thumb-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  margin-left: 12px;
  flex-shrink: 0;
  background: var(--md-sys-color-surface-container-high);
  border-radius: 8px;
}

.file-icon {
  object-fit: contain;
  border-radius: 0;
  background: none;
}

// Overlay styles handled by ChatDownloadOverlay component
</style>
