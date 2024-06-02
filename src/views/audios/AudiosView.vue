<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('page_title.audios') }} ({{ total.toLocaleString() }})</div>
    <div class="actions">
      <search-input :filter="filter" :tags="tags" :buckets="buckets" :get-url="getUrl" />
      <template v-if="checked">
        <button class="btn-icon" @click.stop="deleteItems(dataType, items, realAllChecked, q)" v-tooltip="$t('delete')">
          <md-ripple />
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
        <button class="btn-icon" @click.stop="downloadItems(realAllChecked, q)" v-tooltip="$t('download')">
          <md-ripple />
          <i-material-symbols:download-rounded />
        </button>
        <button class="btn-icon" @click.stop="addItemsToPlaylist($event, realAllChecked, q)" v-tooltip="$t('add_to_playlist')">
          <md-ripple />
          <i-material-symbols:playlist-add />
        </button>
        <button class="btn-icon" @click.stop="addToTags(items, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
          <md-ripple />
          <i-material-symbols:label-outline-rounded />
        </button>
      </template>
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
            <md-menu-item v-for="item in sortItems" @click="sort(slotProps, item.value)" :selected="item.value === audioSortBy">
              <div slot="headline">{{ $t(item.label) }}</div>
            </md-menu-item>
          </div>
        </template>
      </popper>
    </div>
  </div>
  <all-checked-alert :limit="limit" :total="total" :all-checked-alert-visible="allCheckedAlertVisible" :real-all-checked="realAllChecked" :select-real-all="selectRealAll" :clear-selection="clearSelection" />
  <div class="table-responsive">
    <table class="table">
      <thead>
        <tr>
          <th>
            <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
          </th>
          <th v-if="app.developerMode">ID</th>
          <th>{{ $t('name') }}</th>
          <th></th>
          <th class="artist">{{ $t('artist') }}</th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('duration') }}</th>
          <th>{{ $t('file_size') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" :class="{ selected: item.checked }" @click.stop="toggleRow(item)">
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td v-if="app.developerMode"><field-id :id="item.id" :raw="item" /></td>
          <td class="title">
            {{ item.title }}
          </td>
          <td class="nowrap">
            <div class="action-btns">
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
              <button class="btn-icon sm" v-else @click.stop="play(item)" v-tooltip="$t('play')">
                <md-ripple />
                <i-material-symbols:play-circle-outline-rounded />
              </button>
            </div>
          </td>
          <td>
            {{ item.artist }}
          </td>
          <td>
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            {{ formatSeconds(item.duration) }}
          </td>
          <td class="nowrap">
            {{ formatFileSize(item.size) }}
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td :colspan="app.developerMode ? 8 : 7">
            <div class="no-data-placeholder">
              {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatSeconds } from '@/lib/format'
import { audiosGQL, bucketsTagsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute, useRouter } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { formatFileSize } from '@/lib/format'
import type { IAudio, IAudioItem, IBucket, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMediaItemsDeletedEvent, ITag } from '@/lib/interfaces'
import { storeToRefs } from 'pinia'
import { decodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useSearch } from '@/hooks/search'
import { useAddToPlaylist, useAudioPlayer } from '@/hooks/audios'
import { useSelectable } from '@/hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags } from '@/hooks/tags'
import { useDeleteItems } from '@/hooks/media'
import { useDownload, useDownloadItems } from '@/hooks/files'
import { openModal, pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { getFileName } from '@/lib/api/file'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { getSortItems } from '@/lib/file'

const mainStore = useMainStore()
const { audioSortBy } = storeToRefs(mainStore)
const items = ref<IAudioItem[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const { app, urlTokenKey, audioPlaying } = storeToRefs(useTempStore())
const isAudioPlaying = (item: IAudioItem) => {
  return audioPlaying.value && app.value?.audioCurrent === item.path
}

const dataType = DataType.AUDIO
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const tags = ref<ITag[]>([])
const buckets = ref<IBucket[]>([])
const q = ref('')
const { addToTags } = useAddToTags(dataType, tags)
const { deleteItems, deleteItem } = useDeleteItems()
const { allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleRow, toggleItemChecked, total, checked } = useSelectable(items)
const { downloadItems } = useDownloadItems(urlTokenKey, dataType, items, clearSelection, 'audios.zip')
const { downloadFile } = useDownload(urlTokenKey)
const { addItemsToPlaylist, addToPlaylist } = useAddToPlaylist(items, clearSelection)
const sortItems = getSortItems()

const router = useRouter()

const { play, playPath, loading: playLoading, pause } = useAudioPlayer()

const { fetch: fetchBucketsTags } = initLazyQuery({
  handle: async (data: any, error: string) => {
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

const { loading, fetch } = initLazyQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.audios.map((it: IAudio) => ({ ...it, checked: false }))
        total.value = data.audioCount
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

watch(page, (value: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/audios?page=${value}&q=${q}` : `/audios?page=${value}`)
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

function sort(slotProps: any, sort: string) {
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

function addItemToTags(item: IAudioItem) {
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

onActivated(() => {
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetchBucketsTags()
  fetch()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('media_item_deleted', mediaItemDeletedHandler)
  emitter.on('media_items_deleted', mediaItemsDeletedHandler)
  fetch()
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('media_item_deleted', mediaItemDeletedHandler)
  emitter.off('media_items_deleted', mediaItemsDeletedHandler)
})
</script>
<style scoped lang="scss">
.artist {
  min-width: 80px;
}
.title {
  min-width: 120px;
}
</style>
