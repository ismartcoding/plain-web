<template>
  <left-sidebar>
    <template #title>
      {{ $t(`page_title.${group}`) }}
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="viewAll" :class="{ active: !selectedTagId && !selectedBucketId && !trash }">
          <span class="title">{{ $t('all') }}</span>
          <span class="count" v-if="total >= 0">{{ total.toLocaleString() }}</span>
        </li>
        <li v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)" @click.prevent="viewTrash" :class="{ active: trash }">
          <span class="title">{{ $t('trash') }}</span>
          <icon-button class="btn-help sm" v-tooltip="$t('trash_tips')">
            <template #icon>
              <i-material-symbols:help-outline-rounded />
            </template>
          </icon-button>
          <span class="count" v-if="totalTrash >= 0">{{ totalTrash.toLocaleString() }}</span>
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
import { computed, onMounted, onUnmounted, reactive, ref, watch, type PropType } from 'vue'
import { useSearch } from '@/hooks/search'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import type { IFilter, IMediaItemsActionedEvent } from '@/lib/interfaces'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { DataType, FEATURE } from '@/lib/data'
import type { DocumentNode } from 'graphql'
import { initLazyQuery } from '@/lib/api/query'
import { buildQuery } from '@/lib/search'
import emitter from '@/plugins/eventbus'
import { hasFeature } from '@/lib/feature'

const tempStore = useTempStore()
const { app } = storeToRefs(tempStore)
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
const trash = ref(false)
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

const totalTrash = computed(() => {
  if (props.type === DataType.IMAGE) {
    return counter.value?.imagesTrash ?? -1
  } else if (props.type === DataType.VIDEO) {
    return counter.value?.videosTrash ?? -1
  } else if (props.type === DataType.AUDIO) {
    return counter.value?.audiosTrash ?? -1
  }

  return -1
})

const { fetch } = initLazyQuery({
  handle: (data: { total: number; trash: number }) => {
    if (data) {
      if (props.type === DataType.IMAGE) {
        counter.value.images = data.total
        counter.value.imagesTrash = data.trash
      } else if (props.type === DataType.VIDEO) {
        counter.value.videos = data.total
        counter.value.videosTrash = data.trash
      } else if (props.type === DataType.AUDIO) {
        counter.value.audios = data.total
        counter.value.audiosTrash = data.trash
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
  trash.value = filter.trash ?? false
  selectedBucketId.value = filter.bucketId ?? ''
  if (selectedTagId.value && selectedBucketId.value) {
    selectedTagId.value = ''
  }
  if (trash.value) {
    selectedBucketId.value = ''
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

function viewTrash() {
  const q = buildQuery([
    {
      name: 'trash',
      op: '',
      value: 'true',
    },
  ])
  replacePath(mainStore, `/${group.value}?q=${encodeBase64(q)}`)
}

function viewAll() {
  replacePath(mainStore, `/${group.value}`)
}

const mediaItemsActionedHandler = (event: IMediaItemsActionedEvent) => {
  if (event.type === props.type) {
    fetch()
  }
}

onMounted(() => {
  emitter.on('media_items_actioned', mediaItemsActionedHandler)
})

onUnmounted(() => {
  emitter.off('media_items_actioned', mediaItemsActionedHandler)
})
</script>
