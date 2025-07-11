<template>
  <li v-for="item in mediaBuckets" :key="item.id" :class="{ active: selected && item.id === selected }" @click.prevent="view(mainStore, item.id)">
    <span class="title">{{ item.name }}</span
    ><span class="count">{{ item.itemCount.toLocaleString() }}</span>
  </li>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, type PropType } from 'vue'
import { initQuery, mediaBucketsGQL } from '@/lib/api/query'
import type { IBucket, IMediaItemsActionedEvent } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import emitter from '@/plugins/eventbus'
import { useBuckets } from '@/hooks/media'
import { DataType } from '@/lib/data'

const props = defineProps({
  type: { type: String as PropType<DataType>, required: true },
  selected: { type: String, required: true },
})

const { t } = useI18n()

const mainStore = useMainStore()
const mediaBuckets = ref<IBucket[]>([])
const { view } = useBuckets(props.type)

const { refetch } = initQuery({
  handle: (data: { mediaBuckets: IBucket[] }, error: string) => {
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
})

const mediaItemsActionedHandler = (event: IMediaItemsActionedEvent) => {
  if (event.type === props.type) {
    refetch()
  }
}

onMounted(() => {
  emitter.on('media_items_actioned', mediaItemsActionedHandler)
})

onUnmounted(() => {
  emitter.off('media_items_actioned', mediaItemsActionedHandler)
})
</script>
