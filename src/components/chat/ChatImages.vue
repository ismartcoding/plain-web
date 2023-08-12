<template>
  <div class="row row-cols-3 g-1">
    <div class="col" v-for="(item, i) in sources" :key="i" @click="view(i)">
      <img class="image" :src="getPreview(item)" />
      <span class="duration">{{ isVideo(item.name) ? formatSeconds(item.duration) : formatFileSize(item.size) }}</span>
    </div>
  </div>
  <lightbox :visible="visible" :index="index" :sources="sources" @hide="hide" />
</template>

<script setup lang="ts">
import { getFileName, getFileUrl, notId } from '@/lib/api/file'
import { isVideo } from '@/lib/file'
import { computed } from 'vue'
import type { ISource } from '../lightbox/types'
import { useMediaViewer } from '../lightbox/use'
import { formatSeconds, formatFileSize } from '@/lib/format'

const props = defineProps({
  data: { type: Object },
})

const { visible, index, view, hide } = useMediaViewer()

function getPreview(source: ISource) {
  if (source.thumbnail) {
    return source.thumbnail
  }

  if (source.src.startsWith('blob:')) {
    return source.src
  }

  return `${source.src}&w=200&h=200`
}

const sources = computed(() => {
  const data = props.data
  const files = data?._content?.value?.items ?? []
  const items: ISource[] = []
  data?.data?.ids?.forEach((id: string, index: number) => {
    const file = files[index]
    items.push({
      path: '',
      src: getFileUrl(id),
      viewOriginImage: notId(id),
      name: getFileName(file.uri),
      duration: file.duration,
      size: file.size,
      thumbnail: file.thumbnail,
    })
  })

  return items
})
</script>

<style lang="scss" scoped>
.col {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  position: relative;
}

.duration {
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 12px;
  padding: 1px 4px;
}
</style>
