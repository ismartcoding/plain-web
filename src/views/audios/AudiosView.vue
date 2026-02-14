<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.audios') }} ({{ total.toLocaleString() }})</span>
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
          <v-icon-button v-if="uiMode !== 'edit'" v-tooltip="$t('add_to_playlist')" @click.stop="addItemsToPlaylist($event, selectedIds, realAllChecked, q)">
              <i-material-symbols:playlist-add />
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
        :sort-by="audioSortBy"
        :sort-items="sortItems"
        :show-view-toggle="false"
        :on-toggle-ui-mode="toggleUIMode"
        :on-upload-files="uploadFilesClick"
        :on-upload-dir="uploadDirClick"
        :on-open-keyboard-shortcuts="openKeyboardShortcuts"
        :on-sort="sort"
        @update:uploadMenuVisible="(v) => uploadMenuVisible = v"
        @update:moreMenuVisible="(v) => moreMenuVisible = v"
      />
    </div>
  </div>

  <all-checked-alert
    v-if="uiMode === 'edit'"
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="selectRealAll"
    :clear-selection="clearSelection"
  />
  <div class="scroll-content" @dragover.stop.prevent="fileDragEnter">
    <div v-show="dropping" class="drag-mask" @drop.stop.prevent="dropFiles2" @dragleave.stop.prevent="fileDragLeave">{{ $t('release_to_send_files') }}</div>
    <div class="main-list" :class="{ 'select-mode': checked }">
      <AudioListItem
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
        :animating-ids="animatingIds"
        :play-loading="playLoading"
        :play-path="playPath"
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
        :handle-remove-from-playlist="handleRemoveFromPlaylist"
        :add-to-playlist="handleAddToPlaylist"
        :add-item-to-tags="addItemToTags"
        :play="play"
        :pause="pause"
        :is-audio-playing="isAudioPlaying"
        :is-in-playlist="isInPlaylist"
        :restore-loading="restoreLoading"
        :trash-loading="trashLoading"
        :edit-mode="uiMode === 'edit'"
      />
      <template v-if="loading && items.length === 0">
        <AudioSkeletonItem
          v-for="i in 20"
          :key="i"
          :index="i"
          :is-phone="isPhone"
        />
      </template>
    </div>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
    <input ref="fileInput" style="display: none" type="file" accept="audio/*" multiple @change="uploadChanged" />
    <input ref="dirFileInput" style="display: none" type="file" accept="audio/*" multiple webkitdirectory mozdirectory directory @change="dirUploadChanged" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { audiosGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import type { IAudio, IBucket, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMediaItemsActionedEvent } from '@/lib/interfaces'
import type { IUploadItem } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { decodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useSearch } from '@/hooks/search'
import { useAddToPlaylist, useAudioPlayer } from '@/hooks/audios'
import { useSelectable } from '@/hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags } from '@/hooks/tags'
import { useBuckets, useBucketsTags, useDeleteItems } from '@/hooks/media'
import { useDownload, useDownloadItems } from '@/hooks/files'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType, FEATURE } from '@/lib/data'
import { getDirFromPath, getSortItems, isAudio } from '@/lib/file'
import { useKeyEvents } from '@/hooks/key-events'
import { generateDownloadFileName } from '@/lib/format'
import { useDragDropUpload, useFileUpload } from '@/hooks/upload'
import { useMediaRestore, useMediaTrash } from '@/hooks/media-trash'
import { hasFeature } from '@/lib/feature'
import MediaPageActions from '@/components/media/MediaPageActions.vue'
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal.vue'
import { mediaKeyboardShortcuts } from '@/lib/shortcuts/media'

const isPhone = inject('isPhone') as boolean
const mainStore = useMainStore()
const { audioSortBy } = storeToRefs(mainStore)
const items = ref<IAudio[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
  bucketId: undefined,
})
const { app, urlTokenKey, audioPlaying, uploads } = storeToRefs(useTempStore())
const isAudioPlaying = (item: IAudio) => {
  return audioPlaying.value && app.value?.audioCurrent === item.path
}
const animatingIds = ref<string[]>([])
const uploadMenuVisible = ref(false)
const moreMenuVisible = ref(false)

type UIMode = 'view' | 'edit'
const uiMode = computed<UIMode>({
  get: () => (filter.trash ? 'edit' : (mainStore.pageUIMode.audios ?? 'view')),
  set: (value) => {
    if (filter.trash) return
    mainStore.pageUIMode.audios = value
  },
})

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)
const sorting = ref(false)

const dataType = DataType.AUDIO
const route = useRoute()
const page = ref(1)
const limit = 50
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
const { downloadItems } = useDownloadItems(urlTokenKey, dataType, clearSelection, () => generateDownloadFileName('audios'))
const { downloadFile } = useDownload(urlTokenKey)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/audios?page=${page}&q=${q}` : `/audios?page=${page}`)
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
const { addItemsToPlaylist, addToPlaylist, removeFromPlaylist, isInPlaylist } = useAddToPlaylist(items, clearSelection)
const sortItems = getSortItems()
const imageErrorIds = ref<string[]>([])

const { play, playPath, loading: playLoading, pause } = useAudioPlayer()

const onImageError = (id: string) => {
  imageErrorIds.value.push(id)
}

const { loading, fetch } = initLazyQuery({
  handle: (data: { items: IAudio[]; total: number }, error: string) => {
    sorting.value = false
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.items
        total.value = data.total
      }
    }
  },
  document: audiosGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
    sortBy: audioSortBy.value,
  }),
})

const { trashLoading, trash } = useMediaTrash()
const { restoreLoading, restore } = useMediaRestore()

function sort(value: string) {
  if (audioSortBy.value === value) {
    return
  }
  sorting.value = true
  audioSortBy.value = value
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

function getUploadDir() {
  const bucket = buckets.value.find((it) => it.id === filter.bucketId)
  if (bucket) {
    return getDirFromPath(bucket.topItems[0])
  }

  return `${app.value.internalStoragePath}/Music`
}

function uploadFilesClick() {
  uploadFiles(getUploadDir())
}

function uploadDirClick() {
  uploadDir(getUploadDir())
}

function dropFiles2(e: DragEvent) {
  dropFiles(e, getUploadDir(), (file) => isAudio(file.name))
}

const getQuery = () => {
  let query = q.value
  if (!realAllChecked.value) {
    query = `ids:${selectedIds.value.join(',')}`
  }

  return query
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
    // Check if uploaded file is an audio
    if (isAudio(r.fileName)) {
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

function addItemToTags(item: IAudio) {
  const tagIds = item.tags.map((t) => t.id)
  openModal(UpdateTagRelationsModal, {
    type: dataType,
    tags: tags.value,
    item: {
      key: item.id,
      title: item.title,
      size: item.size,
    },
    selected: tags.value.filter((it) => tagIds.includes(it.id)),
  })
}

function handleRemoveFromPlaylist(e: MouseEvent, item: IAudio) {
  animatingIds.value.push(item.id)
  setTimeout(() => {
    removeFromPlaylist(e, item)
    setTimeout(() => {
      animatingIds.value = animatingIds.value.filter((id) => id !== item.id)
    }, 200)  // Delay clearing animation state to avoid jitter
  }, 150) // Start add operation after 90-degree rotation
}

function handleAddToPlaylist(e: MouseEvent, item: IAudio) {
  animatingIds.value.push(item.id)
  setTimeout(() => {
    addToPlaylist(e, item)
    setTimeout(() => {
      animatingIds.value = animatingIds.value.filter((id) => id !== item.id)
    }, 200) // Delay clearing animation state to avoid jitter
  }, 150) // Start add operation after 90-degree rotation
}

// Unified SearchFilters handler

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
<style scoped lang="scss">
:deep(.media-item) {
  grid-template-areas:
    'start image title actions artist time'
    'start image subtitle  actions artist time';
  grid-template-columns: 48px 50px 2fr 240px minmax(64px, 1fr) minmax(140px, auto);
  &:hover {
    cursor: pointer;
  }
  .image {
    width: 50px;
    height: 50px;
    grid-area: image;
    margin-block: 12px;
    text-align: center;
    .svg {
      max-width: 50px;
      max-height: 50px;
    }
  }
  .title {
    margin-inline: 16px;
    padding-block-start: 12px;
  }
  .subtitle {
    grid-area: subtitle;
    margin-inline: 16px;
    margin-block-start: 8px;
    margin-block-end: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.875rem;
  }
  .artist {
    grid-area: artist;
    display: flex;
    align-items: center;
  }
  .time {
    grid-area: time;
    display: flex;
    align-items: center;
    padding-inline: 16px;
    justify-content: end;
  }
}

</style>