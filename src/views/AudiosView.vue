<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.audios')} (${total})`" />
    <template v-if="checked">
      <button class="icon-button" @click.stop="deleteItems(dataType, items, realAllChecked, finalQ)" v-tooltip="$t('delete')">
        <md-ripple />
        <i-material-symbols:delete-forever-outline-rounded />
      </button>
      <button class="icon-button" @click.stop="downloadItems(realAllChecked, finalQ)" v-tooltip="$t('download')">
        <md-ripple />
        <i-material-symbols:download-rounded />
      </button>
      <button
        class="icon-button"
        @click.stop="addItemsToPlaylist($event, realAllChecked, finalQ)"
        v-tooltip="$t('add_to_playlist')"
      >
        <md-ripple />
        <i-material-symbols:playlist-add />
      </button>
      <button class="icon-button" @click.stop="addToTags(realAllChecked, finalQ)" v-tooltip="$t('add_to_tags')">
        <md-ripple />
        <i-material-symbols:label-outline-rounded />
      </button>
    </template>
    <button class="icon-button" @click.stop="upload" v-tooltip="$t('upload')">
      <md-ripple />
      <i-material-symbols:upload-rounded />
    </button>
    <search-input ref="searchInputRef" v-model="q" :search="doSearch">
      <template #filters>
        <div class="filters">
          <md-outlined-text-field :label="$t('keywords')" v-model="filter.text" keyup.enter="applyAndDoSearch" />
          <label class="form-label">{{ $t('tags') }}</label>
          <md-chip-set type="filter">
            <md-filter-chip
              v-for="item in tags"
              :key="item.id"
              :label="item.name"
              :selected="filter.tags.includes(item)"
              @click="onTagSelect(item)"
            />
          </md-chip-set>
          <div class="buttons">
            <md-filled-button @click.stop="applyAndDoSearch">
              {{ $t('search') }}
            </md-filled-button>
          </div>
        </div>
      </template>
    </search-input>
  </div>
  <all-checked-alert
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="selectRealAll"
    :clear-selection="clearSelection"
  />
  <div class="table-responsive">
    <table class="table">
      <thead>
        <tr>
          <th>
            <md-checkbox
              touch-target="wrapper"
              @change="toggleAllChecked"
              :checked="allChecked"
              :indeterminate="!allChecked && checked"
            />
          </th>
          <th>ID</th>
          <th>{{ $t('name') }}</th>
          <th></th>
          <th>{{ $t('artist') }}</th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('duration') }}</th>
          <th>{{ $t('file_size') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          :class="{ selected: item.checked }"
          @click.stop="toggleRow(item)"
        >
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td><field-id :id="item.id" :raw="item" /></td>
          <td>
            {{ item.title }}
          </td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="icon-button" @click.stop="deleteItem(dataType, item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button
                class="icon-button"
                @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))"
                v-tooltip="$t('download')"
              >
                <md-ripple />
                <i-material-symbols:download-rounded />
              </button>
              <button
                class="icon-button"
                @click.stop="addToPlaylist($event, item)"
                v-tooltip="$t('add_to_playlist')"
              >
                <md-ripple />
                <i-material-symbols:playlist-add />
              </button>
              <button class="icon-button" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
              <md-circular-progress indeterminate class="spinner-sm" v-if="playLoading && item.path === playPath" />
              <button
                class="icon-button"
                v-else-if="isAudioPlaying(item)"
                @click.stop="pause()"
                v-tooltip="$t('pause')"
              >
                <md-ripple />
                <i-material-symbols:pause-circle-outline-rounded />
              </button>
              <button class="icon-button" v-else @click.stop="play(item)" v-tooltip="$t('play')">
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
          <td>
            {{ formatFileSize(item.size) }}
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td colspan="8">
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
import { nextTick, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatSeconds } from '@/lib/format'
import { audiosGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute, useRouter } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { formatFileSize } from '@/lib/format'
import type {
  IAudio,
  IAudioItem,
  IFilter,
  IItemTagsUpdatedEvent,
  IItemsTagsUpdatedEvent,
  IMediaItemsDeletedEvent,
  ITag,
} from '@/lib/interfaces'
import { storeToRefs } from 'pinia'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useAddToPlaylist, useAudioPlayer } from './hooks/audios'
import { useSelectable } from './hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags, useTags } from './hooks/tags'
import { useDeleteItems } from './hooks/media'
import { useDownload, useDownloadItems } from './hooks/files'
import { openModal, pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { getFileName } from '@/lib/api/file'
import { remove } from 'lodash-es'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'

const mainStore = useMainStore()
const items = ref<IAudioItem[]>([])
const searchInputRef = ref()
const { t } = useI18n()
const { app, urlTokenKey, audioPlaying } = storeToRefs(useTempStore())
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const isAudioPlaying = (item: IAudioItem) => {
  return audioPlaying.value && app.value?.audioCurrent === item.path
}

const dataType = DataType.AUDIO
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(dataType, q, filter, async (fields: IFilterField[]) => {
  finalQ.value = buildQuery(fields)
  await nextTick() // hack: to fix the lazy query load twice
  load()
})
const { addToTags } = useAddToTags(dataType, items, tags)
const { deleteItems, deleteItem } = useDeleteItems()
const {
  allChecked,
  realAllChecked,
  selectRealAll,
  allCheckedAlertVisible,
  clearSelection,
  toggleAllChecked,
  toggleRow,
  toggleItemChecked,
  total,
  checked,
} = useSelectable(items)
const { downloadItems } = useDownloadItems(urlTokenKey, dataType, items, clearSelection, 'audios.zip')
const { downloadFile } = useDownload(urlTokenKey)
const { addItemsToPlaylist, addToPlaylist } = useAddToPlaylist(items, clearSelection)

const router = useRouter()

const { play, playPath, loading: playLoading, pause } = useAudioPlayer()

const { loading, load, refetch } = initLazyQuery({
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
    query: finalQ.value,
  }),
  appApi: true,
})

watch(page, (value: number) => {
  replacePath(mainStore, `/audios?page=${value}&q=${encodeBase64(q.value)}`)
})

function upload() {
  router.push(`/files`)
  pushModal(ConfirmModal, {
    message: t('upload_audios'),
  })
}

function onTagSelect(item: ITag) {
  if (filter.tags.includes(item)) {
    remove(filter.tags, (it: ITag) => it.id === item.id)
  } else {
    filter.tags.push(item)
  }
}

function applyAndDoSearch() {
  q.value = buildFilterQuery(filter)
  doSearch()
  searchInputRef.value.dismiss()
}

function doSearch() {
  replacePath(mainStore, `/audios?q=${encodeBase64(q.value)}`)
}

const itemsTagsUpdatedHandler = (event: IItemsTagsUpdatedEvent) => {
  if (event.type === dataType) {
    clearSelection()
    refetch()
  }
}

const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
  if (event.type === dataType) {
    refetch()
  }
}

const mediaItemsDeletedHandler = (event: IMediaItemsDeletedEvent) => {
  if (event.type === dataType) {
    clearSelection()
    refetch()
  }
}

const mediaItemDeletedHandler = () => {
  total.value--
}

onActivated(() => {
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('media_item_deleted', mediaItemDeletedHandler)
  emitter.on('media_items_deleted', mediaItemsDeletedHandler)
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('media_item_deleted', mediaItemDeletedHandler)
  emitter.off('media_items_deleted', mediaItemsDeletedHandler)
})

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
</script>
