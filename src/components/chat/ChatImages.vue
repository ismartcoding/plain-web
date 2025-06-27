<template>
  <div class="image-container">
    <div v-for="(item, i) in sources" :key="i" class="media-item" @click="view(i)">
      <img class="image-thumb" :src="getPreview(item)" onerror="this.src='/broken-image.png'" />
      <span class="duration">{{ isVideo(item.name) ? formatSeconds(item.duration) : formatFileSize(item.size) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getFileName, getFileUrl, notId } from '@/lib/api/file'
import { isVideo } from '@/lib/file'
import { computed } from 'vue'
import type { ISource } from '../lightbox/types'
import { formatSeconds, formatFileSize } from '@/lib/format'
import { useTempStore } from '@/stores/temp'

const tempStore = useTempStore()
const props = defineProps({
  data: { type: Object, required: true },
})

function getPreview(source: ISource) {
  if (source.thumbnail) {
    return source.thumbnail
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
      name: getFileName(file.uri),
      duration: file.duration,
      size: file.size,
      thumbnail: file.thumbnail,
      isFromChat: true,
    })
  })

  return items
})
</script>
