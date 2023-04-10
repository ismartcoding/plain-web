<template>
  <div class="row row-cols-3 g-1">
    <div class="col" v-for="(item, i) in sources" :key="i" @click="view(i)">
      <img class="image" :src="item.src + '&w=200&h=200'" />
      <span class="duration" v-if="isVideo(item.name)">{{ formatSeconds(item.duration) }}</span>
    </div>
  </div>
  <lightbox :visible="visible" :index="index" :sources="sources" @hide="hide" />
</template>

<script setup lang="ts">
import { getFileName, getFileUrl } from '@/lib/api/file'
import { isVideo } from '@/lib/file'
import { computed } from 'vue'
import type { ISource } from '../lightbox/types'
import { useMediaViewer } from '../lightbox/use'
import { formatSeconds } from '@/lib/format'

const props = defineProps({
  data: { type: Object },
})

const { visible, index, view, hide } = useMediaViewer()

const sources = computed(() => {
  const files = props.data?._content?.value?.items ?? []
  const items: ISource[] = []
  props.data?.data?.ids?.forEach((id: string, index: number) => {
    const file = files[index]
    items.push({
      path: '',
      src: getFileUrl(id),
      name: getFileName(file.uri),
      duration: file.duration,
      size: file.size,
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
