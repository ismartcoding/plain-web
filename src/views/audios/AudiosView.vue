<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.audios') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <template v-if="filter.trash">
          <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)">
            <template #icon>
              <i-material-symbols:delete-forever-outline-rounded />
            </template>
          </v-icon-button>
          <v-icon-button v-tooltip="$t('restore')" :loading="restoreLoading(getQuery())" @click.stop="restore(dataType, getQuery())">
            <template #icon>
              <i-material-symbols:restore-from-trash-outline-rounded />
            </template>
          </v-icon-button>
          <v-icon-button v-tooltip="$t('download')" @click.stop="downloadItems(realAllChecked, selectedIds, q)">
            <template #icon>
              <i-material-symbols:download-rounded />
            </template>
          </v-icon-button>
        </template>
        <template v-else>
          <v-icon-button v-if="hasFeature(FEATURE.MEDIA_TRASH, app.osVersion)" v-tooltip="$t('move_to_trash')" :loading="trashLoading(getQuery())" @click.stop="trash(dataType, getQuery())">
            <template #icon>
              <i-material-symbols:delete-outline-rounded />
            </template>
          </v-icon-button>
          <v-icon-button v-else v-tooltip="$t('delete')" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)">
            <template #icon>
              <i-material-symbols:delete-forever-outline-rounded />
            </template>
          </v-icon-button>
          <v-icon-button v-tooltip="$t('download')" @click.stop="downloadItems(realAllChecked, selectedIds, q)">
            <template #icon>
              <i-material-symbols:download-rounded />
            </template>
          </v-icon-button>
          <v-icon-button v-tooltip="$t('add_to_playlist')" @click.stop="addItemsToPlaylist($event, selectedIds, realAllChecked, q)">
            <template #icon>
              <i-material-symbols:playlist-add />
            </template>
          </v-icon-button>
          <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addToTags(selectedIds, realAllChecked, q)">
            <template #icon>
              <i-material-symbols:label-outline-rounded />
            </template>
          </v-icon-button>
        </template>
      </template>
    </div>

    <div class="actions">
      <search-input :filter="filter" :tags="tags" :buckets="buckets" :get-url="getUrl" />
      <media-keyboard-shortcuts />
      <v-dropdown v-model="uploadMenuVisible">
        <template #trigger>
          <v-icon-button v-tooltip="$t('upload')">
            <template #icon>
              <i-material-symbols:upload-rounded />
            </template>
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
            <template #icon>
              <i-material-symbols:sort-rounded />
            </template>
          </v-icon-button>
        </template>
        <div v-for="item in sortItems" :key="item.value" class="dropdown-item" :class="{ 'selected': item.value === audioSortBy }" @click="sort(item.value); sortMenuVisible = false">
          {{ $t(item.label) }}
        </div>
      </v-dropdown>
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
    <div class="audio-list" :class="{ 'select-mode': checked }">
      <section
        v-for="(item, i) in items"
        :key="item.id"
        class="media-item selectable-card"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="
          handleItemClick($event, item, i, () => {
            play(item)
          })
        "
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="start">
          <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, i)" />
          <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, i)" />
          <span class="number"><field-id :id="i + 1" :raw="item" /></span>
        </div>
        <div class="image">
          <img v-if="imageErrorIds.includes(item.id)" :src="`/ficons/${getFileExtension(item.path)}.svg`" class="svg" />
          <img v-else class="image-thumb" :src="getFileUrl(item.albumFileId, '&w=200&h=200')" @error="onImageError(item.id)" />
        </div>
        <div class="title">{{ item.title }}</div>
        <div class="subtitle">
          <span>{{ formatFileSize(item.size) }}</span>
          <span class="duration">
            {{ formatSeconds(item.duration) }}
          </span>
          <a @click.stop.prevent="viewBucket(mainStore, item.bucketId)">{{ bucketsMap[item.bucketId]?.name }}</a>
          <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
        </div>
        <div class="actions">
          <template v-if="filter.trash">
            <v-icon-button v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
              <template #icon>
                <i-material-symbols:delete-forever-outline-rounded />
              </template>
            </v-icon-button>
            <v-icon-button v-tooltip="$t('restore')" class="sm" :loading="restoreLoading(`ids:${item.id}`)" @click.stop="restore(dataType, `ids:${item.id}`)">
              <template #icon>
                <i-material-symbols:restore-from-trash-outline-rounded />
              </template>
            </v-icon-button>
            <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
              <template #icon>
                <i-material-symbols:download-rounded />
              </template>
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
              <template #icon>
                <i-material-symbols:delete-outline-rounded />
              </template>
            </v-icon-button>
            <v-icon-button v-else v-tooltip="$t('delete')" class="sm" @click.stop="deleteItem(dataType, item)">
              <template #icon>
                <i-material-symbols:delete-forever-outline-rounded />
              </template>
            </v-icon-button>
            <v-icon-button v-tooltip="$t('download')" class="sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))">
              <template #icon>
                <i-material-symbols:download-rounded />
              </template>
            </v-icon-button>
            <v-icon-button v-if="isInPlaylist(item) && !animatingIds.includes(item.id)" v-tooltip="$t('remove_from_playlist')" class="sm" @click.stop.prevent="handleRemoveFromPlaylist($event, item)">
              <template #icon>
                <i-material-symbols:playlist-remove class="playlist-remove-icon" />
              </template>
            </v-icon-button>
            <v-icon-button v-else-if="animatingIds.includes(item.id)" class="sm" :disabled="true">
              <template #icon>
                <i-material-symbols:playlist-remove class="playlist-remove-icon rotating" />
              </template>
            </v-icon-button>
            <v-icon-button v-else v-tooltip="$t('add_to_playlist')" class="sm" @click.stop.prevent="addToPlaylist($event, item)">
              <template #icon>
                <i-material-symbols:playlist-add />
              </template>
            </v-icon-button>
            <v-icon-button v-tooltip="$t('add_to_tags')" class="sm" @click.stop="addItemToTags(item)">
              <template #icon>
                <i-material-symbols:label-outline-rounded />
              </template>
            </v-icon-button>
          </template>
          <v-circular-progress v-if="playLoading && item.path === playPath" indeterminate class="sm" />
          <v-icon-button v-else-if="isAudioPlaying(item)" v-tooltip="$t('pause')" class="sm" @click.stop="pause()">
            <template #icon>
              <i-material-symbols:pause-circle-outline-rounded />
            </template>
          </v-icon-button>
        </div>
        <div class="artist">{{ item.artist }}</div>
        <div class="time">
          <span v-tooltip="formatDateTime(item.createdAt)">
            {{ formatTimeAgo(item.createdAt) }}
          </span>
        </div>
      </section>
      <template v-if="loading && items.length === 0">
        <section v-for="i in 20" :key="i" class="media-item selectable-card-skeleton">
          <div class="start">
            <div class="checkbox">
              <div class="skeleton-checkbox"></div>
            </div>
            <span class="number">{{ i }}</span>
          </div>
          <div class="image">
            <div class="skeleton-image"></div>
          </div>
          <div class="title">
            <div class="skeleton-text skeleton-title"></div>
          </div>
          <div class="subtitle">
            <div class="skeleton-text skeleton-subtitle"></div>
          </div>
          <div class="actions">
            <div class="skeleton-text skeleton-actions"></div>
          </div>
          <div class="artist">
            <div class="skeleton-text skeleton-artist"></div>
          </div>
          <div class="time">
            <div class="skeleton-text skeleton-time"></div>
          </div>
        </section>
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
import { computed, onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'
import { formatSeconds } from '@/lib/format'
import { audiosGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { getFileUrl, getFileExtension } from '@/lib/api/file'
import { formatFileSize } from '@/lib/format'
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
import { getFileName } from '@/lib/api/file'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType, FEATURE } from '@/lib/data'
import { getDirFromPath, getSortItems, isAudio } from '@/lib/file'
import { useKeyEvents } from '@/hooks/key-events'
import { formatDateTime, formatTimeAgo, generateDownloadFileName } from '@/lib/format'
import { useDragDropUpload, useFileUpload } from '@/hooks/upload'
import { useMediaRestore, useMediaTrash } from '@/hooks/media-trash'
import { hasFeature } from '@/lib/feature'

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
const sortMenuVisible = ref(false)

const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)
const sorting = ref(false)

const dataType = DataType.AUDIO
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
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
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  if (hasFeature(FEATURE.MEDIA_TRASH, app.value.osVersion)) {
    trash(dataType, getQuery())
  } else {
    deleteItems(dataType, selectedIds.value, realAllChecked.value, total.value, q.value)
  }
})
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

function getUrl(q: string) {
  return q ? `/audios?q=${q}` : `/audios`
}

function sort(value: string) {
  if (audioSortBy.value === value) {
    return
  }
  sorting.value = true
  audioSortBy.value = value
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
  dropFiles(e, getUploadDir(), 'audio')
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
    }, 300) // 动画完成后移除
  }, 150) // 旋转到90度后开始移除操作
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
<style scoped lang="scss">
.media-item {
  display: grid;
  border-radius: 8px;
  grid-template-areas:
    'start image title actions artist time'
    'start image subtitle  actions artist time';
  grid-template-columns: 48px 50px 2fr 240px minmax(64px, 1fr) minmax(140px, auto);
  &:hover {
    cursor: pointer;
  }
  .start {
    grid-area: start;
  }
  .number {
    font-size: 0.75rem;
    display: flex;
    justify-content: center;
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
    grid-area: title;
    font-weight: 500;
    margin-inline: 16px;
    padding-block-start: 12px;
    word-break: break-all;
  }
  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.875rem;
    margin-inline: 16px;
    margin-block-start: 8px;
    margin-block-end: 12px;
  }
  .artist {
    grid-area: artist;
    display: flex;
    align-items: center;
  }
  .actions {
    grid-area: actions;
    display: flex;
    flex-direction: row;
    gap: 4px;
    align-items: center;
    visibility: visible;
    padding-inline: 16px;
  }
  .time {
    grid-area: time;
    display: flex;
    align-items: center;
    padding-inline: 16px;
    justify-content: end;
  }
}
.audio-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.audio-list.select-mode {
  .media-item {
    .actions {
      visibility: hidden;
    }
  }
}

.audio-list {
  .media-item {
    .skeleton-image {
      width: 50px;
      height: 50px;
    }
    .skeleton-title {
      width: 50%;
      height: 24px;
    }
    .skeleton-subtitle {
      width: 40%;
      height: 20px;
    }
    .skeleton-actions {
      width: 140px;
      height: 20px;
    }
    .skeleton-artist {
      width: 60px;
      height: 20px;
    }
    .skeleton-time {
      width: 60px;
      height: 20px;
    }
  }
}

.playlist-remove-icon {
  color: var(--md-sys-color-error) !important;
}

.rotating {
  animation: rotate-icon 300ms ease-in-out;
}

@keyframes rotate-icon {
  0% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(90deg);
  }
  100% {
    transform: rotate(0deg);
  }
}


</style>
