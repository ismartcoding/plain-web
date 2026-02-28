<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.images') }} ({{ total.toLocaleString() }})</span>
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
        :sort-by="imageSortBy"
        :sort-items="sortItems"
        :show-view-toggle="true"
        :card-view="mainStore.imagesCardView"
        :on-toggle-ui-mode="toggleUIMode"
        :on-upload-files="uploadFilesClick"
        :on-upload-dir="uploadDirClick"
        :hide-view-toggle="isGroupMode"
        :on-sort="sort"
        :show-view-options="true"
        :show-group-by="true"
        :group-by-items="groupByItems"
        :group-by="mainStore.imagesGroupBy"
        :scroll-paging="mainStore.imagesScrollPaging"
        :on-open-keyboard-shortcuts="openKeyboardShortcuts"
        :on-update-card-view="(value: boolean) => mainStore.imagesCardView = value"
        @update:uploadMenuVisible="(v) => uploadMenuVisible = v"
        @update:moreMenuVisible="(v) => moreMenuVisible = v"
        @update:groupBy="(v) => mainStore.imagesGroupBy = v"
        @update:scrollPaging="(v) => mainStore.imagesScrollPaging = v"
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
      :sort-by="imageSortBy"
      :sort-items="sortItems"
      :show-view-toggle="true"
      :card-view="mainStore.imagesCardView"
      :hide-view-toggle="isGroupMode"
      :on-sort="sort"
      :show-view-options="true"
      :show-group-by="true"
      :group-by-items="groupByItems"
      :group-by="mainStore.imagesGroupBy"
      :scroll-paging="mainStore.imagesScrollPaging"
      :on-open-keyboard-shortcuts="openKeyboardShortcuts"
      :on-update-card-view="(value: boolean) => mainStore.imagesCardView = value"
      @update:uploadMenuVisible="(v) => uploadMenuVisible = v"
      @update:moreMenuVisible="(v) => moreMenuVisible = v"
      @update:groupBy="(v) => mainStore.imagesGroupBy = v"
      @update:scrollPaging="(v) => mainStore.imagesScrollPaging = v"
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

    <!-- Grouped by taken time -->
    <template v-if="isGroupMode">
      <template v-if="loading && items.length === 0">
        <div class="media-grid">
          <section v-for="i in limit" :key="i" class="skeleton-image media-item"></section>
        </div>
      </template>
      <div v-for="group in groupedItems" :key="group.date" class="image-group">
        <div class="group-date-label">{{ group.dateLabel }}</div>
        <div class="media-grid" :class="{ 'select-mode': checked }">
          <MediaGridItem
            v-for="{ item, idx } in group.entries"
            :key="item.id"
            :item="item"
            :checked="checked"
            :selected-ids="selectedIds"
            :shift-effecting-ids="shiftEffectingIds"
            :should-select="shouldSelect"
            :data-type="dataType"
            @item-click="(e) => handleItemClick(e, item, idx, view)"
            @item-mouse-enter="(e) => handleMouseOverMode(e, idx)"
            @toggle-select="(e) => toggleSelect(e, item, idx)"
            @view="view(idx)"
          >
            <template #thumbnail>
              <img class="image-thumb image" :src="getFileUrl(item.fileId, '&w=200&h=200')" onerror="this.src='/broken-image.png'" />
            </template>
            <template #info-right>{{ formatFileSize(item.size) }}</template>
          </MediaGridItem>
        </div>
      </div>
    </template>

    <!-- Regular grid view -->
    <div v-else-if="!mainStore.imagesCardView" class="media-grid" :class="{ 'select-mode': checked }">
      <MediaGridItem
        v-for="(item, i) in items"
        :key="item.id"
        :item="item"
        :checked="checked"
        :selected-ids="selectedIds"
        :shift-effecting-ids="shiftEffectingIds"
        :should-select="shouldSelect"
        :data-type="dataType"
        @item-click="(e) => handleItemClick(e, item, i, view)"
        @item-mouse-enter="(e) => handleMouseOverMode(e, i)"
        @toggle-select="(e) => toggleSelect(e, item, i)"
        @view="view(i)"
      >
        <template #thumbnail>
          <img class="image-thumb image" :src="getFileUrl(item.fileId, '&w=200&h=200')" onerror="this.src='/broken-image.png'" />
        </template>
        <template #info-right>{{ formatFileSize(item.size) }}</template>
      </MediaGridItem>
      <template v-if="loading && items.length === 0">
        <section v-for="i in limit" :key="i" class="skeleton-image media-item"></section>
      </template>
    </div>
    <!-- Card list view -->
    <div v-else class="main-list media-list" :class="{ 'select-mode': checked }">
      <ImageListItem
        v-for="(item, i) in items"
        :key="item.id"
        :item="item"
        :index="i"
        :is-phone="isPhone"
        :selected-ids="selectedIds"
        :shift-effecting-ids="shiftEffectingIds"
        :should-select="shouldSelect"
        :buckets-map="bucketsMap"
        :filter="filter"
        :data-type="dataType"
        :main-store="mainStore"
        :app="app"
        :handle-item-click="handleItemClick"
        :handle-mouse-over="handleMouseOverMode"
        :toggle-select="toggleSelect"
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
    <v-pagination v-if="!scrollMode && total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" :page-size="limit" :on-change-page-size="onChangePageSize" />
    <div v-if="scrollMode" ref="sentinel" class="scroll-sentinel">
      <v-circular-progress v-if="loading && items.length > 0" indeterminate class="sm" />
    </div>
    <input ref="fileInput" style="display: none" type="file" accept="image/*" multiple @change="uploadChanged" />
    <input ref="dirFileInput" style="display: none" type="file" accept="image/*" multiple webkitdirectory mozdirectory directory @change="dirUploadChanged" />
  </div>
</template>

<script setup lang="ts">
import { inject, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { computed } from 'vue'
import { imagesGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { getFileId, getFileUrl } from '@/lib/api/file'
import { formatFileSize } from '@/lib/format'
import type { IBucket, IFilter, IImage, IImageItem, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMediaItemsActionedEvent } from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import { decodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useSearch } from '@/hooks/search'
import { useAddToTags } from '@/hooks/tags'
import { getFileName } from '@/lib/api/file'
import { useSelectable } from '@/hooks/list'
import { useBuckets, useBucketsTags, useDeleteItems } from '@/hooks/media'
import { useDownload, useDownloadItems } from '@/hooks/files'
import { useDragDropUpload, useFileUpload } from '@/hooks/upload'
import { createBucketUploadTarget } from '@/hooks/media-upload'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import type { ISource } from '@/components/lightbox/types'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType, FEATURE } from '@/lib/data'
import { getDirFromPath, getImageSortItems, getImageGroupByItems, isImage } from '@/lib/file'
import { useKeyEvents } from '@/hooks/key-events'
import { generateDownloadFileName } from '@/lib/format'
import { useMediaRestore, useMediaTrash } from '@/hooks/media-trash'
import { hasFeature } from '@/lib/feature'
import ImageListItem from '@/components/images/ImageListItem.vue'
import MediaPageActions from '@/components/media/MediaPageActions.vue'
import MediaGridItem from '@/components/media/MediaGridItem.vue'
import { useGroupedScroll } from '@/hooks/grouped-scroll'
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal.vue'
import { mediaKeyboardShortcuts } from '@/lib/shortcuts/media'

const isPhone = inject('isPhone') as boolean
const mainStore = useMainStore()
const { imageSortBy } = storeToRefs(mainStore)
const items = ref<IImageItem[]>([])
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

type UIMode = 'view' | 'edit'
const uiMode = computed<UIMode>({
  get: () => (filter.trash ? 'edit' : (mainStore.pageUIMode.images ?? 'view')),
  set: (value) => {
    if (filter.trash) return
    mainStore.pageUIMode.images = value
  },
})

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)
const sorting = ref(false)

const dataType = DataType.IMAGE
const route = useRoute()
const page = ref(1)
const limit = computed(() => mainStore.pageSize)
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
const { downloadItems } = useDownloadItems(urlTokenKey, dataType, clearSelection, () => generateDownloadFileName('images'))
const { downloadFile } = useDownload(urlTokenKey)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/images?page=${page}&q=${q}` : `/images?page=${page}`)
}

function onChangePageSize(size: number) {
  mainStore.pageSize = size
  const q = route.query.q
  replacePath(mainStore, q ? `/images?page=1&q=${q}` : `/images?page=1`)
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
const sortItems = getImageSortItems()
const groupByItems = getImageGroupByItems()
const { noMore, sentinel, isGroupMode, scrollMode, groupedItems, setupSentinelObserver, teardownObserver, prefetchNext } = useGroupedScroll({
  items,
  getLoading: () => loading.value,
  limit,
  page,
  doFetch: () => fetch(),
  getScrollPaging: () => mainStore.imagesScrollPaging,
  getGroupBy: () => mainStore.imagesGroupBy,
})

const sources = computed<ISource[]>(() => {
  return items.value.map((it: IImageItem) => ({
    src: getFileUrl(it.fileId),
    name: getFileName(it.path),
    duration: 0,
    size: it.size,
    path: it.path,
    type: dataType,
    data: it,
  })) as ISource[]
})

function view(index: number) {
  tempStore.lightbox = {
    sources: sources.value,
    index: index,
    visible: true,
  }
}

function toggleUIMode() {
  if (filter.trash) return
  clearSelection()
  uiMode.value = uiMode.value === 'edit' ? 'view' : 'edit'
}

function openKeyboardShortcuts() {
  openModal(KeyboardShortcutsModal, {
    title: t('keyboard_shortcuts'),
    shortcuts: mediaKeyboardShortcuts,
  })
}

function handleMouseOverMode(event: MouseEvent, index: number) {
  if (uiMode.value !== 'edit') return
  handleMouseOver(event, index)
}

const getQuery = () => {
  let query = q.value
  if (!realAllChecked.value) {
    query = `ids:${selectedIds.value.join(',')}`
  }

  return query
}

function addItemToTags(item: IImageItem) {
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

function sort(value: string) {
  if (imageSortBy.value === value) {
    return
  }
  sorting.value = true
  page.value = 1
  noMore.value = false
  items.value = []
  imageSortBy.value = value
}

watch(
  () => mainStore.imagesGroupBy,
  () => {
    page.value = 1
    noMore.value = false
    items.value = []
    fetch()
  }
)

watch(
  () => mainStore.imagesScrollPaging,
  () => {
    page.value = 1
    items.value = []
    fetch()
  }
)

const { loading, fetch } = initLazyQuery({
  handle: async (data: { images: IImage[]; imageCount: number }, error: string) => {
    sorting.value = false
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        const list = data.images.map((item) => ({ ...item, fileId: getFileId(urlTokenKey.value, item.path, item.id) }))
        if (scrollMode.value && page.value > 1) {
          const existingIds = new Set(items.value.map((i) => i.id))
          items.value = items.value.concat(list.filter((i) => !existingIds.has(i.id)))
        } else {
          items.value = list
        }
        total.value = data.imageCount
        if (scrollMode.value) {
          noMore.value = list.length < limit.value
          prefetchNext()
        }
      }
    }
  },
  document: imagesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit.value,
    limit: limit.value,
    query: q.value,
    sortBy: isGroupMode.value ? 'TAKEN_AT_DESC' : imageSortBy.value,
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
    modalId: 'upload-directory-picker-images',
    storageKey: 'plainweb.uploadDir.images',
  },
})

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
  dropFiles(e, uploadTarget.resolveTargetDir, (file) => isImage(file.name))
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
    // Check if uploaded file is an image
    if (isImage(r.fileName)) {
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
  if (scrollMode.value) {
    page.value = 1
    noMore.value = false
    items.value = []
  }
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
  if (scrollMode.value) {
    setTimeout(setupSentinelObserver, 100)
  }
})

onDeactivated(() => {
  isActive.value = false
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('media_items_actioned', mediaItemsActionedHandler)
  emitter.off('upload_task_done', uploadTaskDoneHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
  teardownObserver()
})
</script>

