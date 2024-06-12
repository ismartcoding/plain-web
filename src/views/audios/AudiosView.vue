<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.audios') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <button class="btn-icon" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, total, q)" v-tooltip="$t('delete')">
          <md-ripple />
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
        <button class="btn-icon" @click.stop="downloadItems(realAllChecked, selectedIds, q)" v-tooltip="$t('download')">
          <md-ripple />
          <i-material-symbols:download-rounded />
        </button>
        <button class="btn-icon" @click.stop="addItemsToPlaylist($event, selectedIds, realAllChecked, q)" v-tooltip="$t('add_to_playlist')">
          <md-ripple />
          <i-material-symbols:playlist-add />
        </button>
        <button class="btn-icon" @click.stop="addToTags(selectedIds, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
          <md-ripple />
          <i-material-symbols:label-outline-rounded />
        </button>
      </template>
    </div>

    <div class="actions">
      <search-input :filter="filter" :tags="tags" :buckets="buckets" :get-url="getUrl" />
      <popper>
        <button class="btn-icon" v-tooltip="$t('upload')">
          <md-ripple />
          <i-material-symbols:upload-rounded />
        </button>
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
        <button class="btn-icon btn-sort" v-tooltip="$t('sort')">
          <md-ripple />
          <i-material-symbols:sort-rounded />
        </button>
        <template #content="slotProps">
          <div class="menu-items">
            <md-menu-item v-for="item in sortItems" :key="item.value" @click="sort(slotProps, item.value)" :selected="item.value === audioSortBy">
              <div slot="headline">{{ $t(item.label) }}</div>
            </md-menu-item>
          </div>
        </template>
      </popper>
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
    <div class="audio-list" :class="{ 'select-mode': checked }">
      <section
        class="media-item selectable-card"
        v-for="(item, i) in items"
        :key="item.id"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="
          handleItemClick($event, item, i, () => {
            play(item)
          })
        "
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="start">
          <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="shouldSelect" />
          <md-checkbox v-else class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="selectedIds.includes(item.id)" />
          <span class="number"><field-id :id="i + 1" :raw="item" /></span>
        </div>
        <i-material-symbols:library-music-outline-rounded v-if="imageErrorIds.includes(item.id)" class="image" />
        <img v-else class="image" :src="getFileUrl(item.albumFileId, '&w=200&h=200')" @error="onImageError(item.id)" />
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
          <button class="btn-icon sm" @click.stop="deleteItem(dataType, item)" v-tooltip="$t('delete')">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
          <button class="btn-icon sm" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))" v-tooltip="$t('download')">
            <md-ripple />
            <i-material-symbols:download-rounded />
          </button>
          <button class="btn-icon sm" @click.stop.prevent="addToPlaylist($event, item)" v-tooltip="$t('add_to_playlist')">
            <md-ripple />
            <i-material-symbols:playlist-add />
          </button>
          <button class="btn-icon sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
            <md-ripple />
            <i-material-symbols:label-outline-rounded />
          </button>
          <md-circular-progress indeterminate class="spinner-sm" v-if="playLoading && item.path === playPath" />
          <button class="btn-icon sm" v-else-if="isAudioPlaying(item)" @click.stop="pause()" v-tooltip="$t('pause')">
            <md-ripple />
            <i-material-symbols:pause-circle-outline-rounded />
          </button>
        </div>
        <div class="artist">{{ item.artist }}</div>
        <div class="time">
          <span v-tooltip="formatDateTime(item.createdAt)">
            {{ formatTimeAgo(item.createdAt) }}
          </span>
        </div>
      </section>
      <template v-if="loading && items.length === 0">
        <section class="media-item selectable-card-skeleton" v-for="i in limit" :key="i">
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
    <div class="no-data-placeholder" v-if="!loading && items.length === 0">
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
import { audiosGQL, bucketsTagsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { getFileUrl } from '@/lib/api/file'
import { formatFileSize } from '@/lib/format'
import type { IAudio, IBucket, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMediaItemsDeletedEvent, ITag } from '@/lib/interfaces'
import { storeToRefs } from 'pinia'
import { decodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useSearch } from '@/hooks/search'
import { useAddToPlaylist, useAudioPlayer } from '@/hooks/audios'
import { useSelectable } from '@/hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags } from '@/hooks/tags'
import { useBuckets, useDeleteItems } from '@/hooks/media'
import { useDownload, useDownloadItems } from '@/hooks/files'
import { openModal } from '@/components/modal'
import { getFileName } from '@/lib/api/file'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { getDirFromPath, getSortItems } from '@/lib/file'
import { useKeyEvents } from '@/hooks/key-events'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import { useDragDropUpload, useFileUpload } from '@/hooks/upload'

const mainStore = useMainStore()
const { audioSortBy } = storeToRefs(mainStore)
const items = ref<IAudio[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const { app, urlTokenKey, audioPlaying, uploads } = storeToRefs(useTempStore())
const isAudioPlaying = (item: IAudio) => {
  return audioPlaying.value && app.value?.audioCurrent === item.path
}
const { input: fileInput, upload: uploadFiles, uploadChanged } = useFileUpload(uploads)
const { input: dirFileInput, upload: uploadDir, uploadChanged: dirUploadChanged } = useFileUpload(uploads)
const { dropping, fileDragEnter, fileDragLeave, dropFiles } = useDragDropUpload(uploads)

const dataType = DataType.AUDIO
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
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
  handleItemClick,
  handleMouseOver,
  selectAll,
  shouldSelect,
} = useSelectable(items)
const { downloadItems } = useDownloadItems(urlTokenKey, dataType, clearSelection, 'audios.zip')
const { downloadFile } = useDownload(urlTokenKey)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/audios?page=${page}&q=${q}` : `/audios?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  deleteItems(dataType, selectedIds.value, realAllChecked.value, total.value, q.value)
})
const { addItemsToPlaylist, addToPlaylist } = useAddToPlaylist(items, clearSelection)
const sortItems = getSortItems()
const imageErrorIds = ref<string[]>([])

const { play, playPath, loading: playLoading, pause } = useAudioPlayer()

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

const onImageError = (id: string) => {
  imageErrorIds.value.push(id)
}

const { loading, fetch } = initLazyQuery({
  handle: (data: { items: IAudio[]; total: number }, error: string) => {
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
  appApi: true,
})

function getUrl(q: string) {
  return q ? `/audios?q=${q}` : `/audios`
}

function sort(slotProps: { close: () => void }, sort: string) {
  audioSortBy.value = sort
  slotProps.close()
}

function getUploadDir() {
  const bucket = buckets.value.find((it) => it.id === filter.bucketId)
  if (bucket) {
    return getDirFromPath(bucket.topItems[0])
  }

  return `${app.value.internalStoragePath}/Music`
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
  dropFiles(e, getUploadDir(), 'audio')
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
<style scoped lang="scss">
.media-item {
  display: grid;
  border-radius: 8px;
  grid-template-areas:
    'start image title actions artist time'
    'start image subtitle  actions artist time';
  grid-template-columns: 48px 50px 2fr 210px minmax(64px, 1fr) minmax(140px, auto);
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
    object-fit: cover;
    border-radius: 8px;
    margin-block: 12px;
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
</style>
