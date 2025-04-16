<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.images') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <template v-if="filter.trash">
          <icon-button v-tooltip="$t('delete')" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)">
            <template #icon>
              <i-material-symbols:delete-forever-outline-rounded />
            </template>
          </icon-button>
          <icon-button v-tooltip="$t('restore')" :loading="restoreLoading(getQuery())" @click.stop="restore(dataType, getQuery())">
            <template #icon>
              <i-material-symbols:restore-from-trash-outline-rounded />
            </template>
          </icon-button>
          <icon-button v-tooltip="$t('download')" @click.stop="downloadItems(realAllChecked, selectedIds, q)">
            <template #icon>
              <i-material-symbols:download-rounded />
            </template>
          </icon-button>
        </template>
        <template v-else>
          <icon-button v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)" v-tooltip="$t('move_to_trash')" :loading="trashLoading(getQuery())" @click.stop="trash(dataType, getQuery())">
            <template #icon>
              <i-material-symbols:delete-outline-rounded />
            </template>
          </icon-button>
          <icon-button v-else v-tooltip="$t('delete')" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)">
            <template #icon>
              <i-material-symbols:delete-forever-outline-rounded />
            </template>
          </icon-button>
          <icon-button v-tooltip="$t('download')" @click.stop="downloadItems(realAllChecked, selectedIds, q)">
            <template #icon>
              <i-material-symbols:download-rounded />
            </template>
          </icon-button>
          <icon-button v-tooltip="$t('add_to_tags')" @click.stop="addToTags(selectedIds, realAllChecked, q)">
            <template #icon>
              <i-material-symbols:label-outline-rounded />
            </template>
          </icon-button>
        </template>
      </template>
    </div>
    <div class="actions">
      <search-input :filter="filter" :tags="tags" :buckets="buckets" :get-url="getUrl" />
      <popper v-if="!filter.trash">
        <icon-button v-tooltip="$t('upload')">
          <template #icon>
            <i-material-symbols:upload-rounded />
          </template>
        </icon-button>
        <template #content="slotProps">
          <md-menu-item @click.stop="uploadFilesClick(slotProps)">
            <div slot="headline">{{ $t('upload_files') }}</div>
          </md-menu-item>
          <md-menu-item @click.stop="uploadDirClick(slotProps)">
            <div slot="headline">{{ $t('upload_folder') }}</div>
          </md-menu-item>
        </template>
      </popper>
      <popper>
        <icon-button v-tooltip="$t('sort')" :loading="sorting">
          <template #icon>
            <i-material-symbols:sort-rounded />
          </template>
        </icon-button>
        <template #content="slotProps">
          <div class="menu-items">
            <md-menu-item v-for="item in sortItems" :key="item.value" :selected="item.value === imageSortBy" @click="sort(slotProps, item.value)">
              <div slot="headline">{{ $t(item.label) }}</div>
            </md-menu-item>
          </div>
        </template>
      </popper>
      <md-outlined-segmented-button-set class="sm">
        <md-outlined-segmented-button data-value="grid" no-checkmark :selected="!mainStore.imagesCardView" @click="mainStore.imagesCardView = false">
          <i-material-symbols:grid-view-outline-rounded slot="icon" />
        </md-outlined-segmented-button>
        <md-outlined-segmented-button data-value="card" no-checkmark :selected="mainStore.imagesCardView" @click="mainStore.imagesCardView = true">
          <i-material-symbols:splitscreen-outline slot="icon" />
        </md-outlined-segmented-button>
      </md-outlined-segmented-button-set>
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
  <div class="scroll-content" @dragover.stop.prevent="fileDragEnter">
    <div v-show="dropping" class="drag-mask" @drop.stop.prevent="dropFiles2" @dragleave.stop.prevent="fileDragLeave">{{ $t('release_to_send_files') }}</div>
    <div v-if="!mainStore.imagesCardView" class="media-grid" :class="{ 'select-mode': checked }">
      <section
        v-for="(item, i) in items"
        :key="item.id"
        class="media-item"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleItemClick($event, item, i, view)"
        @mouseover="handleMouseOver($event, i)"
      >
        <img class="image-thumb image" :src="getFileUrl(item.fileId, '&w=200&h=200')" onerror="this.src='/broken-image.png'" />
        <icon-button v-if="shiftEffectingIds.includes(item.id)" class="btn-checkbox" @click.stop="toggleSelect($event, item, i)">
          <template #icon>
            <i-material-symbols:check-circle-rounded v-if="shouldSelect" />
            <i-material-symbols:check-circle-outline-rounded v-else />
          </template>
        </icon-button>
        <icon-button v-else-if="selectedIds.includes(item.id)" class="btn-checkbox" @click.stop="toggleSelect($event, item, i)">
          <template #icon>
            <i-material-symbols:check-circle-rounded />
          </template>
        </icon-button>
        <template v-else>
          <icon-button class="btn-checkbox" @click.stop="toggleSelect($event, item, i)">
            <template #icon>
              <i-material-symbols:check-circle-rounded v-if="selectedIds.includes(item.id)" />
              <i-material-symbols:check-circle-outline-rounded v-else />
            </template>
          </icon-button>
          <icon-button v-if="checked" v-tooltip="$t('open')" class="btn-zoom sm" @click.stop="view(i)">
            <template #icon>
              <i-material-symbols:zoom-in-rounded />
            </template>
          </icon-button>
          <div v-else class="actions">
            <template v-if="filter.trash">
              <icon-button v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
                <template #icon>
                  <i-material-symbols:delete-forever-outline-rounded />
                </template>
              </icon-button>
              <icon-button v-tooltip="$t('restore')" class="sm" :loading="restoreLoading(`ids:${item.id}`)" @click.stop="restore(dataType, `ids:${item.id}`)">
                <template #icon>
                  <i-material-symbols:restore-from-trash-outline-rounded />
                </template>
              </icon-button>
              <icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
                <template #icon>
                  <i-material-symbols:download-rounded />
                </template>
              </icon-button>
            </template>
            <template v-else>
              <icon-button
                v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)"
                v-tooltip="$t('move_to_trash')"
                class="sm"
                :loading="trashLoading(`ids:${item.id}`)"
                @click.stop="trash(dataType, `ids:${item.id}`)"
              >
                <template #icon>
                  <i-material-symbols:delete-outline-rounded />
                </template>
              </icon-button>
              <icon-button v-else v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
                <template #icon>
                  <i-material-symbols:delete-forever-outline-rounded />
                </template>
              </icon-button>
              <icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
                <template #icon>
                  <i-material-symbols:download-rounded />
                </template>
              </icon-button>
              <icon-button v-tooltip="$t('add_to_tags')" class="sm" @click.stop="addItemToTags(item)">
                <template #icon>
                  <i-material-symbols:label-outline-rounded />
                </template>
              </icon-button>
            </template>
          </div>
          <div class="info" :class="{ 'has-tags': item.tags.length > 0 }">
            <item-tags :tags="item.tags" :type="dataType" />
            <span class="right">{{ formatFileSize(item.size) }}</span>
          </div>
        </template>
      </section>
      <template v-if="loading && items.length === 0">
        <section v-for="i in limit" :key="i" class="skeleton-image media-item"></section>
      </template>
    </div>
    <div v-else class="media-list" :class="{ 'select-mode': checked }">
      <section
        v-for="(item, i) in items"
        :key="item.id"
        class="media-item selectable-card"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleItemClick($event, item, i, view)"
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="start">
          <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, i)" />
          <md-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, i)" />
          <span class="number"><field-id :id="i + 1" :raw="item" /></span>
        </div>
        <img class="image" :src="getFileUrl(item.fileId, '&w=200&h=200')" onerror="this.src='/broken-image.png'" />
        <div class="title">{{ getFileName(item.path) }}</div>
        <div class="subtitle">
          <span>{{ formatFileSize(item.size) }}</span>
          <a @click.stop.prevent="viewBucket(mainStore, item.bucketId)">{{ bucketsMap[item.bucketId]?.name }}</a>
          <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
        </div>
        <div class="actions">
          <template v-if="filter.trash">
            <icon-button v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
              <template #icon>
                <i-material-symbols:delete-forever-outline-rounded />
              </template>
            </icon-button>
            <icon-button v-tooltip="$t('restore')" class="sm" :loading="restoreLoading(`ids:${item.id}`)" @click.stop="restore(dataType, `ids:${item.id}`)">
              <template #icon>
                <i-material-symbols:restore-from-trash-outline-rounded />
              </template>
            </icon-button>
            <icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
              <template #icon>
                <i-material-symbols:download-rounded />
              </template>
            </icon-button>
          </template>
          <template v-else>
            <icon-button
              v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)"
              v-tooltip="$t('move_to_trash')"
              class="sm"
              :loading="trashLoading(`ids:${item.id}`)"
              @click.stop="trash(dataType, `ids:${item.id}`)"
            >
              <template #icon>
                <i-material-symbols:delete-outline-rounded />
              </template>
            </icon-button>
            <icon-button v-else v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
              <template #icon>
                <i-material-symbols:delete-forever-outline-rounded />
              </template>
            </icon-button>
            <icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
              <template #icon>
                <i-material-symbols:download-rounded />
              </template>
            </icon-button>
            <icon-button v-tooltip="$t('add_to_tags')" class="sm" @click.stop="addItemToTags(item)">
              <template #icon>
                <i-material-symbols:label-outline-rounded />
              </template>
            </icon-button>
          </template>
        </div>
        <div class="time">
          <span v-tooltip="formatDateTime(item.createdAt)">
            {{ formatTimeAgo(item.createdAt) }}
          </span>
        </div>
      </section>
      <image-video-list-skeleton v-if="loading && items.length === 0" :limit="limit" />
    </div>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
    <input ref="fileInput" style="display: none" type="file" accept="image/*" multiple @change="uploadChanged" />
    <input ref="dirFileInput" style="display: none" type="file" accept="image/*" multiple webkitdirectory mozdirectory directory @change="dirUploadChanged" />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, reactive, ref } from 'vue'
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
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import type { ISource } from '@/components/lightbox/types'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType, FEATURE } from '@/lib/data'
import { getDirFromPath, getSortItems, isImage } from '@/lib/file'
import { useKeyEvents } from '@/hooks/key-events'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import { useMediaRestore, useMediaTrash } from '@/hooks/media-trash'
import { hasFeature } from '@/lib/feature'

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

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)
const sorting = ref(false)

const dataType = DataType.IMAGE
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
const { downloadItems } = useDownloadItems(urlTokenKey, dataType, clearSelection, 'images.zip')
const { downloadFile } = useDownload(urlTokenKey)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/images?page=${page}&q=${q}` : `/images?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  if (hasFeature(FEATURE.MEDIA_TRASH, app.value.osVersion)) {
    trash(dataType, getQuery())
  } else {
    deleteItems(dataType, selectedIds.value, realAllChecked.value, total.value, q.value)
  }
})
const sortItems = getSortItems()

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

function sort(slotProps: { close: () => void }, sort: string) {
  if (imageSortBy.value === sort) {
    slotProps.close()
    return
  }
  // only sort the last column
  sorting.value = true
  imageSortBy.value = sort
  slotProps.close()
}

const { loading, fetch } = initLazyQuery({
  handle: async (data: { images: IImage[]; imageCount: number }, error: string) => {
    sorting.value = false
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        const list = []
        for (const item of data.images) {
          list.push({ ...item, fileId: getFileId(urlTokenKey.value, item.path, item.id) })
        }
        items.value = list
        total.value = data.imageCount
      }
    }
  },
  document: imagesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
    sortBy: imageSortBy.value,
  }),
})

const { trashLoading, trash } = useMediaTrash()
const { restoreLoading, restore } = useMediaRestore()

function getUrl(q: string) {
  return q ? `/images?q=${q}` : `/images`
}

function getUploadDir() {
  const bucket = buckets.value.find((it) => it.id === filter.bucketId)
  if (bucket) {
    return getDirFromPath(bucket.topItems[0])
  }

  return `${app.value.internalStoragePath}/Pictures`
}

function uploadFilesClick(slotProps: { close: () => void }) {
  uploadFiles(getUploadDir())
  slotProps.close()
}

function uploadDirClick(slotProps: { close: () => void }) {
  uploadDir(getUploadDir())
  slotProps.close()
}

function dropFiles2(e: DragEvent) {
  dropFiles(e, getUploadDir(), 'image')
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
    }
  }
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
