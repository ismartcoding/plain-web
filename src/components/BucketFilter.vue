<template>
  <li
    v-for="item in mediaBuckets"
    :key="item.id"
    @click.prevent="view(item)"
    :class="{ active: selected && item.id === selected }"
  >
    {{ item.name }} ({{ item.itemCount }})
  </li>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { initQuery, mediaBucketsGQL } from '@/lib/api/query'
import { replacePath } from '@/plugins/router'
import type { IBucket, IMediaItem, IMediaItemDeletedEvent, IMediaItemsDeletedEvent } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import { encodeBase64 } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import emitter from '@/plugins/eventbus'

const props = defineProps({
  type: { type: String, required: true },
  selected: { type: String, required: true },
})
const { t } = useI18n()

const mainStore = useMainStore()
const mediaBuckets = ref<IBucket[]>([])

const { refetch } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        mediaBuckets.value = data.mediaBuckets
      }
    }
  },
  document: mediaBucketsGQL,
  variables: {
    type: props.type,
  },
  appApi: true,
})

function view(item: IBucket) {
  const q = buildQuery([
    {
      name: 'bucket_id',
      op: '',
      value: item.id,
    },
  ])
  const names: Record<string, string> = {
    AUDIO: 'audios',
    IMAGE: 'images',
    VIDEO: 'videos',
  }
  replacePath(mainStore, `/${names[props.type]}?q=${encodeBase64(q)}`)
}

const mediaItemsDeletedHandler = (event: IMediaItemsDeletedEvent) => {
  if (event.type === props.type) {
    refetch()
  }
}

const mediaItemDeletedHandler = (event: IMediaItemDeletedEvent) => {
  if (event.item.bucketId && event.type === props.type) {
    refetch()
  }
}

onMounted(() => {
  emitter.on('media_items_deleted', mediaItemsDeletedHandler)
  emitter.on('media_item_deleted', mediaItemDeletedHandler)
})

onUnmounted(() => {
  emitter.off('media_items_deleted', mediaItemsDeletedHandler)
  emitter.off('media_item_deleted', mediaItemDeletedHandler)
})
</script>
