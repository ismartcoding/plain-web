<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.videos') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <template v-if="filter.trash">
          <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)">
              <i-material-symbols:delete-forever-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('restore')" :loading="restoreLoading(getQuery())" @click.stop="restore(dataType, getQuery())">
              <i-material-symbols:restore-from-trash-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('download')" @click.stop="downloadItems(realAllChecked, selectedIds, q)">
              <i-material-symbols:download-rounded />
          </v-icon-button>
        </template>
        <template v-else>
          <v-icon-button v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)" v-tooltip="$t('move_to_trash')" :loading="trashLoading(getQuery())" @click.stop="trash(dataType, getQuery())">
              <i-material-symbols:delete-outline-rounded />
          </v-icon-button>
          <v-icon-button v-else v-tooltip="$t('delete')" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)">
              <i-material-symbols:delete-forever-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('download')" @click.stop="downloadItems(realAllChecked, selectedIds, q)">
              <i-material-symbols:download-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addToTags(selectedIds, realAllChecked, q)">
              <i-material-symbols:label-outline-rounded />
          </v-icon-button>
        </template>
      </template>
    </div>
    <div v-if="!isPhone || !checked" class="actions">
      <search-input :filter="filter" :tags="tags" :buckets="buckets" :get-url="getUrl" :show-chips="!isPhone" :is-phone="isPhone"/>
      <media-keyboard-shortcuts />
      <v-dropdown v-if="!filter.trash" v-model="uploadMenuVisible">
        <template #trigger>
          <v-icon-button v-tooltip="$t('upload')">
              <i-material-symbols:upload-rounded />
          </v-icon-button>
        </template>
        <div class="dropdown-item" @click.stop="uploadFilesClick(); uploadMenuVisible = false">
          {{ $t('upload_files') }}
        </div>
        <div class="dropdown-item" @click.stop="uploadDirClick(); uploadMenuVisible = false">
          {{ $t('upload_folder') }}
        </div>
      </v-dropdown>
      <v-dropdown v-model="sortMenuVisible">
        <template #trigger>
          <v-icon-button v-tooltip="$t('sort')" :loading="sorting">
              <i-material-symbols:sort-rounded />
          </v-icon-button>
        </template>
        <div v-for="item in sortItems" :key="item.value" class="dropdown-item" :class="{ 'selected': item.value === videoSortBy }" @click="sort(item.value); sortMenuVisible = false">
          {{ $t(item.label) }}
        </div>
      </v-dropdown>
      <ViewToggleButtons 
        v-if="!isPhone"
        :card-view="mainStore.videosCardView" 
        @update:card-view="(value: boolean) => mainStore.videosCardView = value" 
      />
    </div>
  </div>
  <div v-if="isPhone && !checked" class="secondary-actions">
    <ViewToggleButtons 
        :card-view="mainStore.videosCardView" 
        @update:card-view="(value: boolean) => mainStore.videosCardView = value" 
      />
  </div>

  <SearchFilters
    v-if="isPhone"
    class="mobile-search-filters"
    :filter="filter"
    :tags="tags"
    :feeds="[]"
    :buckets="buckets"
    :types="[]"
    @filter-change="onFilterChange"
  />
  <all-checked-alert
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="selectRealAll"
    :clear-selection="clearSelection"
  />
  <div class="scroll-content" @dragover.stop.prevent="fileDragEnter">
    <div v-show="dropping" class="drag-mask" @drop.stop.prevent="dropFiles2" @dragleave.stop.prevent="fileDragLeave">{{ $t('release_to_send_files') }}</div>
    <div v-if="!mainStore.videosCardView" class="media-grid" :class="{ 'select-mode': checked }">
      <section
        v-for="(item, i) in items"
        :key="item.id"
        class="media-item"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleItemClick($event, item, i, view)"
        @mouseover="handleMouseOver($event, i)"
      >
        <img v-if="imageErrorIds.includes(item.id)" :src="`/ficons/${getFileExtension(item.path)}.svg`" class="image svg" />
        <img v-else class="image image-thumb" :src="getFileUrl(item.fileId, '&w=200&h=200')" @error="onImageError(item.id)" />
        <v-icon-button v-if="shiftEffectingIds.includes(item.id)" class="btn-checkbox" @click.stop="toggleSelect($event, item, i)">
            <i-material-symbols:check-circle-rounded v-if="shouldSelect" />
            <i-material-symbols:check-circle-outline-rounded v-else />
        </v-icon-button>
        <v-icon-button v-else-if="selectedIds.includes(item.id)" class="btn-checkbox" @click.stop="toggleSelect($event, item, i)">
            <i-material-symbols:check-circle-rounded />
        </v-icon-button>
        <template v-else>
          <v-icon-button class="btn-checkbox" @click.stop="toggleSelect($event, item, i)">
              <i-material-symbols:check-circle-rounded v-if="selectedIds.includes(item.id)" />
              <i-material-symbols:check-circle-outline-rounded v-else />
          </v-icon-button>
          <v-icon-button v-if="checked" v-tooltip="$t('open')" class="btn-zoom sm" @click.stop="view(i)">
              <i-material-symbols:zoom-in-rounded />
          </v-icon-button>
          <div v-else class="actions">
            <template v-if="filter.trash">
              <v-icon-button v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
                  <i-material-symbols:delete-forever-outline-rounded />
              </v-icon-button>
              <v-icon-button v-tooltip="$t('restore')" class="sm" :loading="restoreLoading(`ids:${item.id}`)" @click.stop="restore(dataType, `ids:${item.id}`)">
                  <i-material-symbols:restore-from-trash-outline-rounded />
              </v-icon-button>
              <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
                  <i-material-symbols:download-rounded />
              </v-icon-button>
            </template>
            <template v-else>
              <v-icon-button
                v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)"
                v-tooltip="$t('move_to_trash')"
                class="sm"
                :loading="trashLoading(`ids:${item.id}`)"
                @click.stop="trash(dataType, `ids:${item.id}`)"
              >
                  <i-material-symbols:delete-outline-rounded />
              </v-icon-button>
              <v-icon-button v-else v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
                  <i-material-symbols:delete-forever-outline-rounded />
              </v-icon-button>
              <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
                  <i-material-symbols:download-rounded />
              </v-icon-button>
              <v-icon-button v-tooltip="$t('add_to_tags')" class="sm" @click.stop="addItemToTags(item)">
                  <i-material-symbols:label-outline-rounded />
              </v-icon-button>
            </template>
          </div>
          <div class="info" :class="{ 'has-tags': item.tags.length > 0 }">
            <item-tags :tags="item.tags" :type="dataType" />
            <span class="right">{{ ['SIZE_ASC', 'SIZE_DESC'].includes(videoSortBy) ? formatFileSize(item.size) : formatSeconds(item.duration) }}</span>
          </div>
        </template>
      </section>
      <template v-if="loading && items.length === 0">
        <section v-for="i in limit" :key="i" class="skeleton-image media-item"></section>
      </template>
    </div>
    <div v-else class="main-list media-list" :class="{ 'select-mode': checked }">
      <VideoListItem
        v-for="(item, i) in items"
        :key="item.id"
        :item="item"
        :index="i"
        :is-phone="isPhone"
        :selected-ids="selectedIds"
        :shift-effecting-ids="shiftEffectingIds"
        :should-select="shouldSelect"
        :image-error-ids="imageErrorIds"
        :buckets-map="bucketsMap"
        :filter="filter"
        :data-type="dataType"
        :main-store="mainStore"
        :app="app"
        :handle-item-click="handleItemClick"
        :handle-mouse-over="handleMouseOver"
        :toggle-select="toggleSelect"
        :on-image-error="onImageError"
        :view-bucket="viewBucket"
        :delete-item="deleteItem"
        :restore="restore"
        :download-file="downloadFile"
        :trash="trash"
        :add-item-to-tags="addItemToTags"
        :view="view"
        :restore-loading="restoreLoading"
        :trash-loading="trashLoading"
      />
      <image-video-list-skeleton v-if="loading && items.length === 0" :limit="limit" :is-phone="isPhone" />
    </div>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
    <input ref="fileInput" style="display: none" type="file" accept="video/*" multiple @change="uploadChanged" />
    <input ref="dirFileInput" style="display: none" type="file" accept="video/*" multiple webkitdirectory mozdirectory directory @change="dirUploadChanged" />
  </div>
</template>

<script setup lang="ts">
import { inject, onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'
import { formatSeconds } from '@/lib/format'
import { computed } from 'vue'
import { videosGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { getFileId, getFileUrl, getFileExtension } from '@/lib/api/file'
import { formatFileSize } from '@/lib/format'
import type { IBucket, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMediaItemsActionedEvent, IVideo, IVideoItem } from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import { decodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useAddToTags } from '@/hooks/tags'
import { getFileName } from '@/lib/api/file'
import { useSelectable } from '@/hooks/list'
import { useBuckets, useBucketsTags, useDeleteItems } from '@/hooks/media'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useDownload, useDownloadItems } from '@/hooks/files'
import type { ISource } from '@/components/lightbox/types'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType, FEATURE } from '@/lib/data'
import { getDirFromPath, getSortItems, isVideo } from '@/lib/file'
import { useSearch } from '@/hooks/search'
import { useKeyEvents } from '@/hooks/key-events'
import { generateDownloadFileName } from '@/lib/format'
import { useDragDropUpload, useFileUpload } from '@/hooks/upload'
import { useMediaRestore, useMediaTrash } from '@/hooks/media-trash'
import { hasFeature } from '@/lib/feature'

const isPhone = inject('isPhone') as boolean
const mainStore = useMainStore()
const { videoSortBy } = storeToRefs(mainStore)
const items = ref<IVideoItem[]>([])
const { t } = useI18n()
const { parseQ, buildQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
  bucketId: undefined,
})
const tempStore = useTempStore()
const { app, urlTokenKey, uploads } = storeToRefs(tempStore)

const uploadMenuVisible = ref(false)
const sortMenuVisible = ref(false)

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)
const sorting = ref(false)

const dataType = DataType.VIDEO
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 55
const { tags, buckets, fetch: fetchBucketsTags } = useBucketsTags(dataType)
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
  handleItemClick,
  handleMouseOver,
  selectAll,
  shouldSelect,
} = useSelectable(items)
const { downloadItems } = useDownloadItems(urlTokenKey, dataType, clearSelection, () => generateDownloadFileName('videos'))
const { downloadFile } = useDownload(urlTokenKey)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/videos?page=${page}&q=${q}` : `/videos?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  if (hasFeature(FEATURE.MEDIA_TRASH, app.value.osVersion)) {
    trash(dataType, getQuery())
  } else {
    deleteItems(dataType, selectedIds.value, realAllChecked.value, total.value, q.value)
  }
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
    sorting.value = false

    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        const list: IVideoItem[] = []
        for (const item of data.videos) {
          list.push({ ...item, fileId: getFileId(urlTokenKey.value, item.path, item.id) })
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
})

const { trashLoading, trash } = useMediaTrash()
const { restoreLoading, restore } = useMediaRestore()

function view(index: number) {
  tempStore.lightbox = {
    sources: sources.value,
    index: index,
    visible: true,
  }
}

const getQuery = () => {
  let query = q.value
  if (!realAllChecked.value) {
    query = `ids:${selectedIds.value.join(',')}`
  }

  return query
}

function sort(value: string) {
  if (videoSortBy.value === value) {
    return
  }
  sorting.value = true
  videoSortBy.value = value
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

function getUploadDir() {
  const bucket = buckets.value.find((it) => it.id === filter.bucketId)
  if (bucket) {
    return getDirFromPath(bucket.topItems[0])
  }

  return `${app.value.internalStoragePath}/Movies`
}

function uploadFilesClick() {
  uploadFiles(getUploadDir())
}

function uploadDirClick() {
  uploadDir(getUploadDir())
}

function dropFiles2(e: DragEvent) {
  dropFiles(e, getUploadDir(), (file) => isVideo(file.name))
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

const mediaItemsActionedHandler = (event: IMediaItemsActionedEvent) => {
  if (event.type === dataType) {
    clearSelection()
    fetch()
  }
}

const uploadTaskDoneHandler = (r: IUploadItem) => {
  if (r.status === 'done') {
    // Check if uploaded file is a video
    if (isVideo(r.fileName)) {
      // Check if the uploaded file matches current bucket filter or show all
      const shouldRefresh = !filter.bucketId || buckets.value.some((bucket) => bucket.id === filter.bucketId && bucket.topItems.some((topItem) => r.dir.startsWith(getDirFromPath(topItem))))

      if (shouldRefresh) {
        // Delay to ensure the API returns latest data
        setTimeout(() => {
          fetch()
        }, 1000)
      }
      
      // Emit event to update sidebar count
      emitter.emit('media_items_actioned', { type: dataType, action: 'upload', query: '' })
    }
  }
}

// Unified SearchFilters handler
function onFilterChange(newFilter: IFilter) {
  Object.assign(filter, newFilter)
  replacePath(mainStore, getUrl(buildQ(filter)))
}

onActivated(() => {
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetchBucketsTags()
  fetch()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('media_items_actioned', mediaItemsActionedHandler)
  emitter.on('upload_task_done', uploadTaskDoneHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('media_items_actioned', mediaItemsActionedHandler)
  emitter.off('upload_task_done', uploadTaskDoneHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
