<template>
  <div class="image-container">
    <div v-for="(item, i) in sources" :key="i" class="media-item" @click="canView ? view(i) : undefined">
      <img v-if="getPreview(item)" class="image-thumb" :src="getPreview(item)" onerror="this.src='/broken-image.png'" />
      <span class="duration">{{ isVideo(item.name) ? formatSeconds(item.duration) : formatFileSize(item.size) }}</span>
      <ChatDownloadOverlay :download-info="downloadInfo" :ring-size="48" border-radius="6px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { getFileName, getFileUrl, notId, getPeerProxyUrl } from '@/lib/api/file'
import { isVideo } from '@/lib/file'
import { computed } from 'vue'
import type { ISource } from '../lightbox/types'
import { formatSeconds, formatFileSize } from '@/lib/format'
import { useTempStore } from '@/stores/temp'
import ChatDownloadOverlay from './ChatDownloadOverlay.vue'

const tempStore = useTempStore()
const props = defineProps({
  data: { type: Object, required: true },
  downloadInfo: { type: Object as () => { downloaded: number; total: number; speed: number; status: string } | null, default: null },
  peer: { type: Object as () => { ip: string; port: number } | null, default: null },
})

const ACTIVE_STATUSES = ['pending', 'downloading', 'paused', 'failed']
function isActiveStatus(status: string) {
  return ACTIVE_STATUSES.includes(status)
}

const canView = computed(() => !props.downloadInfo || !isActiveStatus(props.downloadInfo.status))

function getPreview(source: ISource) {
  if (source.thumbnail) {
    return source.thumbnail
  }

  // During active download there is no local file yet — use peer proxy if available
  if (props.downloadInfo && isActiveStatus(props.downloadInfo.status)) {
    if (props.peer && source.path.startsWith('fsid:')) {
      return getPeerProxyUrl(tempStore.urlTokenKey, props.peer, source.path.slice(4), '&w=200&h=200')
    }
    return ''
  }

  if (source.src.startsWith('blob:')) {
    return source.src
  }

  return `${source.src}&w=200&h=200`
}

function view(index: number) {
  tempStore.lightbox = {
    sources: sources.value,
    index: index,
    visible: true,
  }
}

const sources = computed(() => {
  const data = props.data
  const files = data?._content?.value?.items ?? []
  const items: ISource[] = []
  data?.data?.ids?.forEach((id: string, index: number) => {
    const file = files[index]
    items.push({
      path: file.uri,
      src: getFileUrl(id),
      viewOriginImage: notId(id) || file.uri.endsWith('.gif'),
      name: file.fileName || getFileName(file.uri),
      duration: file.duration,
      size: file.size,
      thumbnail: file.thumbnail,
      isFromChat: true,
    })
  })

  return items
})
</script>

