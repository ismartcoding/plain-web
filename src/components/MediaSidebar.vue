<template>
  <left-sidebar>
    <template #title>
      {{ $t(`page_title.${group}`) }}
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="all" :class="{ active: !selectedTagId && !selectedBucketId }">
          <span class="title">{{ $t('all') }}</span>
          <span class="count" v-if="total >= 0">{{ total.toLocaleString() }}</span>
        </li>
        <bucket-filter :type="props.type" :selected="selectedBucketId" />
      </ul>
      <tag-filter :type="props.type" :selected="selectedTagId" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { computed, reactive, ref, watch, type PropType } from 'vue'
import { useSearch } from '@/hooks/search'
import { decodeBase64 } from '@/lib/strutil'
import type { IFilter } from '@/lib/interfaces'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { DataType } from '@/lib/data'
import type { DocumentNode } from 'graphql'
import { initLazyQuery } from '@/lib/api/query'

const props = defineProps({
  type: {
    type: String as PropType<DataType>,
    required: true,
  },
  gql: { type: Object as PropType<DocumentNode>, required: true },
})

const mainStore = useMainStore()
const { counter } = storeToRefs(useTempStore())
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const group = ref('')
const selectedTagId = ref('')
const selectedBucketId = ref('')
const total = computed(() => {
  if (props.type === DataType.IMAGE) {
    return counter.value?.images ?? -1
  } else if (props.type === DataType.VIDEO) {
    return counter.value?.videos ?? -1
  } else if (props.type === DataType.AUDIO) {
    return counter.value?.audios ?? -1
  }

  return -1
})

const { fetch } = initLazyQuery({
  handle: (data: { total: number }) => {
    if (data) {
      if (props.type === DataType.IMAGE) {
        counter.value.images = data.total
      } else if (props.type === DataType.VIDEO) {
        counter.value.videos = data.total
      } else if (props.type === DataType.AUDIO) {
        counter.value.audios = data.total
      }
    }
  },
  document: props.gql,
  variables: () => ({}),
  appApi: true,
})

function updateActive() {
  const route = router.currentRoute.value
  group.value = route.meta.group || '' // images, videos, audios
  fetch()
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  selectedTagId.value = filter.tagIds.length === 1 ? filter.tagIds[0] : ''
  selectedBucketId.value = filter.bucketId ?? ''
  if (selectedTagId.value && selectedBucketId.value) {
    selectedTagId.value = ''
  }
}

updateActive()

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    updateActive()
  }
)

function all() {
  replacePath(mainStore, `/${group.value}`)
}
</script>
