<template>
  <div class="file-container">
    <div v-for="(item, i) in items" :key="i" class="file-item" @click="clickItem(item)">
      <div class="file-content">
        <div class="file-name">{{ item.name }}</div>
        <div class="file-info">{{ formatFileSize(item.size) }}{{ isVideo(item.name) ? ' / ' + formatSeconds(item.duration) : '' }}</div>
        <div v-if="item.summary" class="file-summary">{{ item.summary }}</div>
      </div>
      <template v-if="isImage(item.name) || isVideo(item.name)">
        <img :src="getPreview(item)" class="file-thumbnail" />
      </template>
      <template v-else>
        <img
          v-if="extensionImageErrorIds.includes(item.name)"
          class="file-thumbnail file-icon"
          src="/ficons/default.svg"
        />
        <img
          v-else-if="item.extension"
          class="file-thumbnail file-icon"
          :src="`/ficons/${item.extension}.svg`"
          @error="onExtensionImageError(item.name)"
        />
        <img
          v-else
          class="file-thumbnail file-icon"
          src="/ficons/default.svg"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getFileName, getFileUrl, notId, getFileExtension } from '@/lib/api/file'
import type { ISource } from '../lightbox/types'
import { isVideo, isImage, canView, isTextFile, canOpenInBrowser } from '@/lib/file'
import { formatSeconds, formatFileSize } from '@/lib/format'
import { useTempStore } from '@/stores/temp'

const tempStore = useTempStore()

const sources = ref<ISource[]>([])
const extensionImageErrorIds = ref<string[]>([])

const props = defineProps({
  data: { type: Object, default: () => ({}) },
})

function getPreview(source: ISource) {
  if (source.thumbnail) {
    return source.thumbnail
  }

  if (source.src.startsWith('blob:')) {
    return source.src
  }

  return `${source.src}&w=50&h=50`
}

const items = computed<ISource[]>(() => {
  const files = props.data?._content?.value?.items ?? []
  const items: ISource[] = []
  props.data?.data?.ids?.forEach((id: string, index: number) => {
    const file = files[index]
    items.push({
      path: file.uri,
      src: getFileUrl(id),
      viewOriginImage: notId(id) || file.uri.endsWith('.gif'),
      name: getFileName(file.uri),
      duration: file.duration,
      size: file.size,
      fileId: id,
      thumbnail: file.thumbnail,
      extension: getFileExtension(file.uri),
      summary: file.summary || undefined,
      isFromChat: true
    })
  })
  return items
})

function onExtensionImageError(name: string) {
  if (!extensionImageErrorIds.value.includes(name)) {
    extensionImageErrorIds.value.push(name)
  }
}

function clickItem(item: ISource) {
  if (isTextFile(item.name) && item.fileId) {
    window.open(`/text-file?id=${encodeURIComponent(item.fileId)}`, '_blank')
  } else if (canOpenInBrowser(item.name)) {
    window.open(item.src, '_blank')
  } else if (canView(item.name)) {
    sources.value = items.value.filter((it) => canView(it.name))
    const idx = sources.value.findIndex((it) => it.src === item.src)
    tempStore.lightbox = {
      sources: sources.value,
      index: idx,
      visible: true,
    }
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

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin-bottom: 6px;
  background-color: var(--md-sys-color-surface-container);
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--md-sys-color-surface-container-high);
  }

  &:last-child {
    margin-bottom: 0;
  }
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
}

.file-info {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface-variant);
  opacity: 0.8;
}

.file-summary {
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
  margin-left: 12px;
  flex-shrink: 0;
}

.file-icon {
  object-fit: contain;
  border-radius: 0;
  background: none;
}

@media (max-width: 768px) {
  .file-item {
    max-width: 100%;
    padding: 10px 12px;
    
    .file-thumbnail {
      width: 40px;
      height: 40px;
      margin-left: 8px;
    }
  }
  .file-icon {
    width: 40px;
    height: 40px;
  }
}
</style>
