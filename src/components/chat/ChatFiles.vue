<template>
  <div class="chat-section">
    <a
      v-for="(item, i) in items"
      :key="i"
      class="file-item"
      target="_blank"
      :href="item.src"
      @click.prevent="clickItem(item)"
    >
      <span class="left">
        <span>{{ item.name }}</span>
        <span class="info"
          >{{ formatFileSize(item.size) }}{{ isVideo(item.name) ? ' / ' + formatSeconds(item.duration) : '' }}</span
        >
      </span>
      <img v-if="isImage(item.name) || isVideo(item.name)" :src="getPreview(item)" />
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getFileName, getFileUrl, notId } from '@/lib/api/file'
import type { ISource } from '../lightbox/types'
import { isVideo, isImage, isAudio } from '@/lib/file'
import { formatSeconds, formatFileSize } from '@/lib/format'
import { useTempStore } from '@/stores/temp'

const tempStore = useTempStore()

const sources = ref<ISource[]>([])

const props = defineProps({
  data: { type: Object },
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
      thumbnail: file.thumbnail,
    })
  })
  return items
})

function clickItem(item: ISource) {
  if (canView(item)) {
    sources.value = items.value.filter((it) => canView(it))
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

function canView(item: ISource) {
  return isImage(item.name) || isVideo(item.name) || isAudio(item.name)
}
</script>

<style lang="scss" scoped>
.file-item {
  padding: 0px 8px 8px 8px;
  flex-flow: row;
  display: flex;
  justify-content: space-between;
  text-decoration: none;

  &:first-child {
    padding-top: 8px;
  }

  .left {
    display: flex;
    flex-flow: column;
    word-break: break-all;

    .info {
      margin-top: 4px;
      color: var(--md-sys-color-secondary);
      font-size: 0.75rem;
    }
  }

  img {
    display: flex;
    width: 50px;
    height: 50px;
    margin-left: 4px;
  }
}
</style>
