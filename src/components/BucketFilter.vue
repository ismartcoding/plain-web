<template>
  <div v-if="sortedBuckets.length" class="section-title">
    {{ $t('folders') }}
    <v-icon-button v-tooltip="isCollapsed ? $t('expand_all') : $t('collapse_all')" @click.prevent="toggleCollapsed">
      <i-material-symbols:expand-more-rounded v-if="isCollapsed" />
      <i-material-symbols:expand-less-rounded v-else />
    </v-icon-button>
  </div>
  <ul v-show="!isCollapsed" class="nav">
    <li
      v-for="item in sortedBuckets" :key="item.id" :class="{ active: selected && item.id === selected }"
      @click.prevent="view(mainStore, item.id)">
      <span v-if="showThumb" class="thumb" :class="thumbClass(item)">
        <template v-if="bucketThumbs(item).length">
          <img v-for="(p, i) in bucketThumbs(item)" :key="i" class="thumb-img" :src="thumbUrl(p)" loading="lazy" alt="" onerror="this.style.display='none'" />
        </template>
        <i-material-symbols:folder-rounded v-else />
      </span>
      <span class="title">{{ item.name }}</span><span class="count">{{ item.itemCount.toLocaleString() }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type PropType } from 'vue'
import { initQuery, mediaBucketsGQL } from '@/lib/api/query'
import type { IBucket, IMediaItemsActionedEvent } from '@/lib/interfaces'
import { useMainStore } from '@/stores/main'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import emitter from '@/plugins/eventbus'
import { useBuckets } from '@/hooks/media'
import { DataType } from '@/lib/data'
import { sortByName } from '@/lib/array'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { getFileId, getFileUrl } from '@/lib/api/file'

const props = defineProps({
  type: { type: String as PropType<DataType>, required: true },
  selected: { type: String, required: true },
})

const { t } = useI18n()

const mainStore = useMainStore()
const tempStore = useTempStore()
const { urlTokenKey } = storeToRefs(tempStore)
const mediaBuckets = ref<IBucket[]>([])

function bucketThumbs(item: IBucket): string[] {
  return item.topItems?.slice(0, 4) ?? []
}

function thumbUrl(path: string): string {
  return getFileUrl(getFileId(urlTokenKey.value, path), '&w=128&h=128')
}

function thumbClass(item: IBucket) {
  return `count-${bucketThumbs(item).length}`
}

const isCollapsed = computed(() => !!mainStore.bucketFilterCollapsed?.[props.type])

const showThumb = computed(() => props.type === DataType.IMAGE || props.type === DataType.VIDEO)

function toggleCollapsed() {
  mainStore.bucketFilterCollapsed[props.type] = !isCollapsed.value
}

const sortedBuckets = computed(() =>
  sortByName(mediaBuckets.value ?? [], (b) => b.name ?? '', { numeric: true })
)
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

<style lang="scss" scoped>
.thumb {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px;
  border-radius: 10px;
  overflow: hidden;
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);

  &.count-1 {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
  }

  &.count-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: minmax(0, 1fr);
  }

  &.count-3,
  &.count-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
  }

  &.count-3 .thumb-img:first-child {
    grid-column: 1 / -1;
  }

  &.count-0 {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: var(--md-sys-color-on-surface-variant);
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: block;
    object-fit: cover;
    object-position: center;
  }
}
</style>
