<template>
  <ul class="nav">
    <li
      v-for="item in mediaBuckets"
      :key="item.id"
      @click.prevent="view(item)"
      :class="{ active: selected && item.id === selected }"
    >
      {{ item.name }} ({{ item.itemCount }})
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { initQuery, mediaBucketsGQL } from '@/lib/api/query'
import { replacePath } from '@/plugins/router'
import type { IBucket } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import { encodeBase64 } from '@/lib/strutil'
import { buildQuery } from '@/lib/search'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  bucketType: { type: String, required: true },
  selected: { type: String, required: true },
})
const { t } = useI18n()

const mainStore = useMainStore()
const mediaBuckets = ref<IBucket[]>([])

initQuery({
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
    type: props.bucketType,
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
  replacePath(mainStore, `/${names[props.bucketType]}?q=${encodeBase64(q)}`)
}
</script>
