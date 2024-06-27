<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.images') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <template v-if="filter.trash">
          <icon-button @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)" v-tooltip="$t('delete')">
            <template #icon>
              <i-material-symbols:delete-forever-outline-rounded />
            </template>
          </icon-button>
          <icon-button @click.stop="restore(dataType, getQuery())" v-tooltip="$t('restore')" :loading="restoreLoading(getQuery())">
            <template #icon>
              <i-material-symbols:restore-from-trash-outline-rounded />
            </template>
          </icon-button>
          <icon-button @click.stop="downloadItems(realAllChecked, selectedIds, q)" v-tooltip="$t('download')">
            <template #icon>
              <i-material-symbols:download-rounded />
            </template>
          </icon-button>
        </template>
        <template v-else>
          <icon-button v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)" @click.stop="trash(dataType, getQuery())" v-tooltip="$t('move_to_trash')" :loading="trashLoading(getQuery())">
            <template #icon>
              <i-material-symbols:delete-outline-rounded />
            </template>
          </icon-button>
          <icon-button v-else @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)" v-tooltip="$t('delete')">
            <template #icon>
              <i-material-symbols:delete-forever-outline-rounded />
            </template>
          </icon-button>
          <icon-button @click.stop="downloadItems(realAllChecked, selectedIds, q)" v-tooltip="$t('download')">
            <template #icon>
              <i-material-symbols:download-rounded />
            </template>
          </icon-button>
          <icon-button @click.stop="addToTags(selectedIds, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
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
            <md-menu-item v-for="item in sortItems" @click="sort(slotProps, item.value)" :key="item.value" :selected="item.value === imageSortBy">
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
    <div class="drag-mask" v-show="dropping" @drop.stop.prevent="dropFiles2" @dragleave.stop.prevent="fileDragLeave">{{ $t('release_to_send_files') }}</div>
    <div class="media-grid" v-if="!mainStore.imagesCardView" :class="{ 'select-mode': checked }">
      <section
        class="media-item"
        v-for="(item, i) in items"
        :key="item.id"
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
          <icon-button v-if="checked" class="btn-zoom sm" @click.stop="view(i)" v-tooltip="$t('open')">
            <template #icon>
              <i-material-symbols:zoom-in-rounded />
            </template>
          </icon-button>
          <div v-else class="actions">
            <template v-if="filter.trash">
              <icon-button class="sm" @click.stop="deleteItem(dataType, item)" v-tooltip="$t('delete')">
                <template #icon>
                  <i-material-symbols:delete-forever-outline-rounded />
                </template>
              </icon-button>
              <icon-button class="sm" @click.stop="restore(dataType, `ids:${item.id}`)" v-tooltip="$t('restore')" :loading="restoreLoading(`ids:${item.id}`)">
                <template #icon>
                  <i-material-symbols:restore-from-trash-outline-rounded />
                </template>
              </icon-button>
              <icon-button class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))" v-tooltip="$t('download')">
                <template #icon>
                  <i-material-symbols:download-rounded />
                </template>
              </icon-button>
            </template>
            <template v-else>
              <icon-button
                v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)"
                class="sm"
                @click.stop="trash(dataType, `ids:${item.id}`)"
                v-tooltip="$t('move_to_trash')"
                :loading="trashLoading(`ids:${item.id}`)"
              >
                <template #icon>
                  <i-material-symbols:delete-outline-rounded />
                </template>
              </icon-button>
              <icon-button v-else class="sm" @click.stop="deleteItem(dataType, item)" v-tooltip="$t('delete')">
                <template #icon>
                  <i-material-symbols:delete-forever-outline-rounded />
                </template>
              </icon-button>
              <icon-button class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))" v-tooltip="$t('download')">
                <template #icon>
                  <i-material-symbols:download-rounded />
                </template>
              </icon-button>
              <icon-button class="sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
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
        <section class="skeleton-image media-item" v-for="i in limit" :key="i"></section>
      </template>
    </div>
    <div v-else class="media-list" :class="{ 'select-mode': checked }">
      <section
        class="media-item selectable-card"
        v-for="(item, i) in items"
        :key="item.id"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleItemClick($event, item, i, view)"
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="start">
          <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="shouldSelect" />
          <md-checkbox v-else class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="selectedIds.includes(item.id)" />
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
            <icon-button class="sm" @click.stop="deleteItem(dataType, item)" v-tooltip="$t('delete')">
              <template #icon>
                <i-material-symbols:delete-forever-outline-rounded />
              </template>
            </icon-button>
            <icon-button class="sm" @click.stop="restore(dataType, `ids:${item.id}`)" v-tooltip="$t('restore')" :loading="restoreLoading(`ids:${item.id}`)">
              <template #icon>
                <i-material-symbols:restore-from-trash-outline-rounded />
              </template>
            </icon-button>
            <icon-button class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))" v-tooltip="$t('download')">
              <template #icon>
                <i-material-symbols:download-rounded />
              </template>
            </icon-button>
          </template>
          <template v-else>
            <icon-button
              v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)"
              class="sm"
              @click.stop="trash(dataType, `ids:${item.id}`)"
              v-tooltip="$t('move_to_trash')"
              :loading="trashLoading(`ids:${item.id}`)"
            >
              <template #icon>
                <i-material-symbols:delete-outline-rounded />
              </template>
            </icon-button>
            <icon-button v-else class="sm" @click.stop="deleteItem(dataType, item)" v-tooltip="$t('delete')">
              <template #icon>
                <i-material-symbols:delete-forever-outline-rounded />
              </template>
            </icon-button>
            <icon-button class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))" v-tooltip="$t('download')">
              <template #icon>
                <i-material-symbols:download-rounded />
              </template>
            </icon-button>
            <icon-button class="sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
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
    <div class="no-data-placeholder" v-if="!loading && items.length === 0">
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
import { getDirFromPath, getSortItems } from '@/lib/file'
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
  appApi: true,
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

onActivated(() => {
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetchBucketsTags()
  fetch()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('media_items_actioned', mediaItemsActionedHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('media_items_actioned', mediaItemsActionedHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
