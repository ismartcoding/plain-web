<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.videos') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <button class="btn-icon" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, q)" v-tooltip="$t('delete')">
          <md-ripple />
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
        <button class="btn-icon" @click.stop="downloadItems(realAllChecked, selectedIds, q)" v-tooltip="$t('download')">
          <md-ripple />
          <i-material-symbols:download-rounded />
        </button>
        <button class="btn-icon" @click.stop="addToTags(selectedIds, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
          <md-ripple />
          <i-material-symbols:label-outline-rounded />
        </button>
      </template>
    </div>

    <div class="actions">
      <search-input :filter="filter" :tags="tags" :buckets="buckets" :get-url="getUrl" />
      <button class="btn-icon" @click.prevent="upload" v-tooltip="$t('upload')">
        <md-ripple />
        <i-material-symbols:upload-rounded />
      </button>
      <popper>
        <button class="btn-icon btn-sort" v-tooltip="$t('sort')">
          <md-ripple />
          <i-material-symbols:sort-rounded />
        </button>
        <template #content="slotProps">
          <div class="menu-items">
            <md-menu-item v-for="item in sortItems" :key="item.value" @click="sort(slotProps, item.value)" :selected="item.value === videoSortBy">
              <div slot="headline">{{ $t(item.label) }}</div>
            </md-menu-item>
          </div>
        </template>
      </popper>
      <button class="btn-icon" @click.prevent="changeViewType" v-tooltip="$t(mainStore.videosCardView ? 'grid_view' : 'card_view')">
        <md-ripple />
        <i-material-symbols:grid-view-outline-rounded v-if="mainStore.videosCardView" />
        <i-material-symbols:splitscreen-outline v-else />
      </button>
    </div>
  </div>
  <all-checked-alert
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="selectRealAll"
    :clear-selection="clearSelection"
  />
  <div class="scroll-content">
    <div class="media-grid" v-if="!mainStore.videosCardView" :class="{ 'select-mode': checked }">
      <div
        class="media-item"
        v-for="(item, i) in items"
        :key="item.id"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleMouseDown($event, item, i, view)"
        @mouseover="handleMouseOver($event, i)"
      >
        <i-material-symbols:video-library-outline-rounded v-if="imageErrorIds.includes(item.id)" class="image" />
        <img v-else class="image" :src="getFileUrl(item.fileId, '&w=200&h=200')" @error="onImageError(item.id)" />
        <button v-if="shiftEffectingIds.includes(item.id)" class="btn-icon btn-checkbox" @click.stop="toggleSelect($event, item, i)">
          <md-ripple />
          <i-material-symbols:check-circle-rounded v-if="shouldSelect" />
          <i-material-symbols:check-circle-outline-rounded v-else />
        </button>
        <button v-else-if="selectedIds.includes(item.id)" class="btn-icon btn-checkbox" @click.stop="toggleSelect($event, item, i)">
          <md-ripple />
          <i-material-symbols:check-circle-rounded />
        </button>
        <template v-else>
          <div class="actions" @mousedown.stop="() => {}">
            <button class="btn-icon sm btn-checkbox" @click.stop="toggleSelect($event, item, i)">
              <md-ripple />
              <i-material-symbols:check-circle-rounded v-if="selectedIds.includes(item.id)" />
              <i-material-symbols:check-circle-outline-rounded v-else />
            </button>
            <template v-if="checked">
              <button class="btn-icon sm" @click.stop="view(i)" v-tooltip="$t('open')">
                <md-ripple />
                <i-material-symbols:zoom-in-rounded />
              </button>
            </template>
            <template v-else>
              <button class="btn-icon sm" @click.stop="deleteItem(dataType, item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button class="btn-icon sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))" v-tooltip="$t('download')">
                <md-ripple />
                <i-material-symbols:download-rounded />
              </button>
              <button class="btn-icon sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
            </template>
          </div>
          <div class="info" @mousedown.stop="() => {}">
            <item-tags :tags="item.tags" :type="dataType" />
            <span class="right">{{ ['SIZE_ASC', 'SIZE_DESC'].includes(videoSortBy) ? formatFileSize(item.size) : formatSeconds(item.duration) }}</span>
          </div>
        </template>
      </div>
    </div>
    <div v-else class="media-list" :class="{ 'select-mode': checked }">
      <section
        class="media-item selectable-card"
        v-for="(item, i) in items"
        :key="item.id"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleMouseDown($event, item, i, view)"
        @mouseover="handleMouseOver($event, i)"
      >
        <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="shouldSelect" />
        <md-checkbox v-else class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="selectedIds.includes(item.id)" />
        <span class="number"><field-id :id="i + 1" :raw="item" /></span>
        <i-material-symbols:video-library-outline-rounded v-if="imageErrorIds.includes(item.id)" class="image" @click.stop="view(i)" />
        <img v-else class="image" :src="getFileUrl(item.fileId, '&w=200&h=200')" @click.stop="view(i)" @error="onImageError(item.id)" />
        <div class="right">
          <div class="title">{{ getFileName(item.path) }}</div>
          <div class="info">
            <span>{{ formatFileSize(item.size) }}</span>
            <span>·</span>
            <span>{{ formatSeconds(item.duration) }}</span>
            <span>·</span>
            <span class="time" v-tooltip="formatDateTime(item.createdAt)">
              {{ formatTimeAgo(item.createdAt) }}
            </span>
          </div>
          <div class="info">
            <a @click.stop.prevent="viewBucket(mainStore, item.bucketId)">{{ bucketsMap[item.bucketId]?.name }}</a
            ><span v-if="item.tags.length">·</span><item-tags :tags="item.tags" :type="dataType" :only-links="true" />
          </div>
        </div>
        <div v-if="!checked" class="actions">
          <button class="btn-icon sm" @click.stop="deleteItem(dataType, item)" v-tooltip="$t('delete')">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
          <button class="btn-icon sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))" v-tooltip="$t('download')">
            <md-ripple />
            <i-material-symbols:download-rounded />
          </button>
          <button class="btn-icon sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
            <md-ripple />
            <i-material-symbols:label-outline-rounded />
          </button>
        </div>
      </section>
    </div>
    <div class="no-data-placeholder" v-if="!mainStore.videosCardView && sources.length === 0">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'
import { formatSeconds } from '@/lib/format'
import { computed } from 'vue'
import { videosGQL, initLazyQuery, bucketsTagsGQL } from '@/lib/api/query'
import { useRoute, useRouter } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { getFileId, getFileUrl } from '@/lib/api/file'
import { formatFileSize } from '@/lib/format'
import type { IBucket, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMediaItemsDeletedEvent, ITag, IVideo, IVideoItem } from '@/lib/interfaces'
import { decodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useAddToTags } from '@/hooks/tags'
import { getFileName } from '@/lib/api/file'
import { useSelectable } from '@/hooks/list'
import { useBuckets, useDeleteItems } from '@/hooks/media'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useDownload, useDownloadItems } from '@/hooks/files'
import type { ISource } from '@/components/lightbox/types'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { getSortItems } from '@/lib/file'
import { useSearch } from '@/hooks/search'
import { useKeyEvents } from '@/hooks/key-events'
import { formatDateTime, formatTimeAgo } from '@/lib/format'

const router = useRouter()
const mainStore = useMainStore()
const { videoSortBy } = storeToRefs(mainStore)
const items = ref<IVideoItem[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const dataType = DataType.VIDEO
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 55
const tags = ref<ITag[]>([])
const buckets = ref<IBucket[]>([])
const bucketsMap = computed(() => {
  const map: Record<string, IBucket> = {}
  buckets.value.forEach((it) => {
    map[it.id] = it
  })
  return map
})
const q = ref('')
const { addToTags } = useAddToTags(dataType, tags)
const { deleteItems, deleteItem } = useDeleteItems()
const { view: viewBucket } = useBuckets(dataType)
const {
  selectedIds,
  allChecked,
  realAllChecked,
  selectRealAll,
  allCheckedAlertVisible,
  clearSelection,
  toggleAllChecked,
  toggleSelect,
  total,
  checked,
  shiftEffectingIds,
  handleMouseDown,
  handleMouseOver,
  selectAll,
  shouldSelect,
} = useSelectable(items)
const { downloadItems } = useDownloadItems(urlTokenKey, dataType, clearSelection, 'videos.zip')
const { downloadFile } = useDownload(urlTokenKey)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/videos?page=${page}&q=${q}` : `/videos?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  deleteItems(dataType, selectedIds.value, realAllChecked.value, q.value)
})
const imageErrorIds = ref<string[]>([])
const sortItems = getSortItems()

const sources = computed<ISource[]>(() => {
  return items.value.map((it: IVideoItem) => ({
    src: getFileUrl(it.fileId),
    name: getFileName(it.path),
    duration: it.duration,
    size: it.size,
    path: it.path,
    data: it,
    type: dataType,
  })) as ISource[]
})

const onImageError = (id: string) => {
  imageErrorIds.value.push(id)
}

const { loading, fetch } = initLazyQuery({
  handle: async (data: { videos: IVideo[]; videoCount: number }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        const list: IVideoItem[] = []
        for (const item of data.videos) {
          list.push({ ...item, fileId: getFileId(urlTokenKey.value, item.path) })
        }
        items.value = list
        total.value = data.videoCount
      }
    }
  },
  document: videosGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
    sortBy: videoSortBy.value,
  }),
  appApi: true,
})

function view(index: number) {
  tempStore.lightbox = {
    sources: sources.value,
    index: index,
    visible: true,
  }
}

const { fetch: fetchBucketsTags } = initLazyQuery({
  handle: async (data: { tags: ITag[]; mediaBuckets: IBucket[] }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        tags.value = data.tags
        buckets.value = data.mediaBuckets
      }
    }
  },
  document: bucketsTagsGQL,
  variables: {
    type: dataType,
  },
  appApi: true,
})

function sort(slotProps: { close: () => void }, sort: string) {
  videoSortBy.value = sort
  slotProps.close()
}

function getUrl(q: string) {
  return q ? `/videos?q=${q}` : `/videos`
}

function addItemToTags(item: IVideoItem) {
  openModal(UpdateTagRelationsModal, {
    type: dataType,
    tags: tags.value,
    item: {
      key: item.id,
      title: item.title,
      size: item.size,
    },
    selected: tags.value.filter((it) => item.tags.some((t) => t.id === it.id)),
  })
}

function changeViewType() {
  mainStore.videosCardView = !mainStore.videosCardView
}

function upload() {
  router.push(`/files`)
  pushModal(ConfirmModal, {
    message: t('upload_videos'),
  })
}

const itemsTagsUpdatedHandler = (event: IItemsTagsUpdatedEvent) => {
  if (event.type === dataType) {
    clearSelection()
    fetch()
  }
}

const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
  if (event.type === dataType) {
    fetch()
  }
}

const mediaItemsDeletedHandler = (event: IMediaItemsDeletedEvent) => {
  if (event.type === dataType) {
    clearSelection()
    fetch()
  }
}

const mediaItemDeletedHandler = () => {
  total.value--
}

onActivated(() => {
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetchBucketsTags()
  fetch()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('media_item_deleted', mediaItemDeletedHandler)
  emitter.on('media_items_deleted', mediaItemsDeletedHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('media_item_deleted', mediaItemDeletedHandler)
  emitter.off('media_items_deleted', mediaItemsDeletedHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
