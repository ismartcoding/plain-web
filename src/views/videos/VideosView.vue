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
          <template v-if="uiMode === 'edit'">
            <v-icon-button v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)" v-tooltip="$t('move_to_trash')" :loading="trashLoading(getQuery())" @click.stop="trash(dataType, getQuery())">
                <i-material-symbols:delete-outline-rounded />
            </v-icon-button>
            <v-icon-button v-else v-tooltip="$t('delete')" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)">
                <i-material-symbols:delete-forever-outline-rounded />
            </v-icon-button>
            <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addToTags(selectedIds, realAllChecked, q)">
                <i-material-symbols:label-outline-rounded />
            </v-icon-button>
          </template>
          <v-icon-button v-tooltip="$t('download')" @click.stop="downloadItems(realAllChecked, selectedIds, q)">
              <i-material-symbols:download-rounded />
          </v-icon-button>
        </template>
      </template>
    </div>
    <div class="actions">
      <MediaPageActions
        placement="top"
        :ui-mode="uiMode"
        :filter-trash="!!filter.trash"
        :is-phone="isPhone"
        :checked="checked"
        :upload-menu-visible="uploadMenuVisible"
        :more-menu-visible="moreMenuVisible"
        :sort-by="videoSortBy"
        :sort-items="sortItems"
        :show-view-toggle="true"
        :card-view="mainStore.videosCardView"
        :on-toggle-ui-mode="toggleUIMode"
        :on-upload-files="uploadFilesClick"
        :on-upload-dir="uploadDirClick"
        :on-open-keyboard-shortcuts="openKeyboardShortcuts"
        :on-sort="sort"
        :on-update-card-view="(value: boolean) => mainStore.videosCardView = value"
        @update:uploadMenuVisible="(v) => uploadMenuVisible = v"
        @update:moreMenuVisible="(v) => moreMenuVisible = v"
      />
    </div>
  </div>
  <div v-if="isPhone && !checked" class="secondary-actions">
    <MediaPageActions
      placement="secondary"
      :ui-mode="uiMode"
      :filter-trash="!!filter.trash"
      :is-phone="isPhone"
      :checked="checked"
      :upload-menu-visible="uploadMenuVisible"
      :more-menu-visible="moreMenuVisible"
      :sort-by="videoSortBy"
      :sort-items="sortItems"
      :show-view-toggle="true"
      :card-view="mainStore.videosCardView"
      :on-open-keyboard-shortcuts="openKeyboardShortcuts"
      :on-sort="sort"
      :on-update-card-view="(value: boolean) => mainStore.videosCardView = value"
      @update:uploadMenuVisible="(v) => uploadMenuVisible = v"
      @update:moreMenuVisible="(v) => moreMenuVisible = v"
    />
  </div>
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
        @mouseenter.stop="handleMouseOverMode($event, i)"
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
        </template>
        <v-icon-button v-if="checked" v-tooltip="$t('open')" class="btn-zoom sm" @click.stop="view(i)">
            <i-material-symbols:zoom-in-rounded />
        </v-icon-button>
        <div class="info" :class="{ 'has-tags': item.tags.length > 0 }">
          <item-tags :tags="item.tags" :type="dataType" />
          <span class="right">{{ ['SIZE_ASC', 'SIZE_DESC'].includes(videoSortBy) ? formatFileSize(item.size) : formatSeconds(item.duration) }}</span>
        </div>
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
        :handle-mouse-over="handleMouseOverMode"
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
        :edit-mode="uiMode === 'edit'"
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
import { inject, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
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
import { createBucketUploadTarget } from '@/hooks/media-upload'
import { useMediaRestore, useMediaTrash } from '@/hooks/media-trash'
import { hasFeature } from '@/lib/feature'
import MediaPageActions from '@/components/media/MediaPageActions.vue'
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal.vue'
import { mediaKeyboardShortcuts } from '@/lib/shortcuts/media'

const isPhone = inject('isPhone') as boolean
const mainStore = useMainStore()
const { videoSortBy } = storeToRefs(mainStore)
const items = ref<IVideoItem[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
  bucketId: undefined,
})
const tempStore = useTempStore()
const { app, urlTokenKey, uploads } = storeToRefs(tempStore)

const uploadMenuVisible = ref(false)
const moreMenuVisible = ref(false)

const uiMode = computed<'view' | 'edit'>({
  get: () => (filter.trash ? 'edit' : (mainStore.pageUIMode.videos ?? 'view')),
  set: (value) => {
    if (filter.trash) return
    mainStore.pageUIMode.videos = value
  },
})

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)
const sorting = ref(false)

const dataType = DataType.VIDEO
const route = useRoute()
const page = ref(1)
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
const selectAllInEditMode = () => {
  if (uiMode.value !== 'edit') return
  selectAll()
}
const clearSelectionInEditMode = () => {
  if (uiMode.value !== 'edit') return
  clearSelection()
}
const trashInEditMode = () => {
  if (uiMode.value !== 'edit') return
  if (hasFeature(FEATURE.MEDIA_TRASH, app.value.osVersion)) {
    trash(dataType, getQuery())
  } else {
    deleteItems(dataType, selectedIds.value, realAllChecked.value, total.value, q.value)
  }
}

const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(
  total,
  limit,
  page,
  selectAllInEditMode,
  clearSelectionInEditMode,
  gotoPage,
  trashInEditMode,
)
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

const uploadTarget = createBucketUploadTarget({
  filter,
  buckets,
  picker: {
    title: t('upload_select_destination'),
    description: t('upload_select_destination_desc'),
    initialPath: '',
    modalId: 'upload-directory-picker-videos',
    storageKey: 'plainweb.uploadDir.videos',
  },
})

function toggleUIMode() {
  if (filter.trash) return
  if (uiMode.value === 'edit') {
    uiMode.value = 'view'
    clearSelection()
  } else {
    uiMode.value = 'edit'
  }
}

function openKeyboardShortcuts() {
  openModal(KeyboardShortcutsModal, {
    title: t('keyboard_shortcuts'),
    shortcuts: mediaKeyboardShortcuts,
  })
}

function handleMouseOverMode(e: MouseEvent, index: number) {
  if (uiMode.value !== 'edit') return
  handleMouseOver(e, index)
}

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

async function uploadFilesClick() {
  const dir = await uploadTarget.resolveTargetDir()
  if (!dir) return
  uploadFiles(dir)
}

async function uploadDirClick() {
  const dir = await uploadTarget.resolveTargetDir()
  if (!dir) return
  uploadDir(dir)
}

function dropFiles2(e: DragEvent) {
  dropFiles(e, uploadTarget.resolveTargetDir, (file) => isVideo(file.name))
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

const isActive = ref(false)

function applyRouteQuery() {
  const nextPage = parseInt(route.query.page?.toString() ?? '1')
  page.value = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
  q.value = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetch()
}

watch(
  () => route.fullPath,
  () => {
    if (!isActive.value) return
    applyRouteQuery()
  }
)

onActivated(() => {
  fetchBucketsTags()
  isActive.value = true
  applyRouteQuery()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('media_items_actioned', mediaItemsActionedHandler)
  emitter.on('upload_task_done', uploadTaskDoneHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  isActive.value = false
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('media_items_actioned', mediaItemsActionedHandler)
  emitter.off('upload_task_done', uploadTaskDoneHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
