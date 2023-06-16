<template>
  <div class="chat-section">
    <a v-for="(item, i) in items" :key="i" class="list-item" target="_blank" :href="item.src">
      <span class="key">{{ item.name }}</span>
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getFileName, getFileUrl } from '@/lib/api/file'
import type { ISource } from '../lightbox/types'

const props = defineProps({
  data: { type: Object },
})

const items = computed(() => {
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
