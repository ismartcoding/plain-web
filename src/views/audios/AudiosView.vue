<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.audios') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <button class="btn-icon" @click.stop="deleteItems(dataType, selectedIds, realAllChecked, q)" v-tooltip="$t('delete')">
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
      <button class="btn-icon" @click.stop="upload" v-tooltip="$t('upload')">
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

  <div class="scroll-content">
    <div class="audio-list" :class="{ 'select-mode': checked }">
      <section
        class="media-item selectable-card"
        v-for="(item, i) in items"
        :key="item.id"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="
          handleMouseDown($event, item, i, () => {
            play(item)
          })
        "
        @mouseover="handleMouseOver($event, i)"
      >
        <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="shouldSelect" />
        <md-checkbox v-else class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="selectedIds.includes(item.id)" />
        <span class="number"><field-id :id="i + 1" :raw="item" /></span>
        <i-material-symbols:library-music-outline-rounded v-if="imageErrorIds.includes(item.id)" class="image" />
        <img v-else class="image" :src="getFileUrl(item.albumFileId, '&w=200&h=200')" @error="onImageError(item.id)" />
        <div class="title">{{ item.title }}</div>
        <div class="subtitle">
          <span>{{ formatFileSize(item.size) }}</span>
          <span>·</span>
          <span class="duration">
            {{ formatSeconds(item.duration) }}
          </span>
          <a @click.stop.prevent="viewBucket(mainStore, item.bucketId)">{{ bucketsMap[item.bucketId]?.name }}</a>
          <template v-if="item.tags.length"> <span>·</span><item-tags :tags="item.tags" :type="dataType" :only-links="true" /> </template>
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
          <button class="btn-icon sm" @click.stop="addToPlaylist($event, item)" v-tooltip="$t('add_to_playlist')">
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
        <div class="time" v-tooltip="formatDateTime(item.createdAt)">
          {{ formatTimeAgo(item.createdAt) }}
        </div>
      </section>
    </div>
    <div class="no-data-placeholder" v-if="items.length === 0">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'
import { formatSeconds } from '@/lib/format'
import { audiosGQL, bucketsTagsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute, useRouter } from 'vue-router'
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
import { openModal, pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { getFileName } from '@/lib/api/file'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { getSortItems } from '@/lib/file'
import { useKeyEvents } from '@/hooks/key-events'
import { formatDateTime, formatTimeAgo } from '@/lib/format'

const mainStore = useMainStore()
const { audioSortBy } = storeToRefs(mainStore)
const items = ref<IAudio[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const { app, urlTokenKey, audioPlaying } = storeToRefs(useTempStore())
const isAudioPlaying = (item: IAudio) => {
  return audioPlaying.value && app.value?.audioCurrent === item.path
}

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
  handleMouseDown,
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
  deleteItems(dataType, selectedIds.value, realAllChecked.value, q.value)
})
const { addItemsToPlaylist, addToPlaylist } = useAddToPlaylist(items, clearSelection)
const sortItems = getSortItems()
const imageErrorIds = ref<string[]>([])

const router = useRouter()

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

function upload() {
  router.push(`/files`)
  pushModal(ConfirmModal, {
    message: t('upload_audios'),
  })
}

function sort(slotProps: { close: () => void }, sort: string) {
  audioSortBy.value = sort
  slotProps.close()
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
    'checkbox image title actions artist time'
    'number image subtitle  actions artist time';
  grid-template-columns: 48px 50px 2fr 1fr minmax(64px, 1fr) auto;
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
  }
  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    font-size: 0.875rem;
    margin-inline: 16px;
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
  }
  .actions {
    grid-area: actions;
    display: flex;
    flex-direction: row;
    gap: 4px;
    align-items: center;
    visibility: visible;
    padding-inline: 16px;
    width: 180px;
  }

  .checkbox {
    grid-area: checkbox;
  }
  .number {
    grid-area: number;
    margin-block-end: 8px;
    font-size: 0.75rem;
    justify-content: center;
    display: flex;
    align-items: end;
  }

  &:hover {
    cursor: pointer;
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
</style>
