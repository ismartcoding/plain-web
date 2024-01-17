<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.images')} (${total})`" />
    <template v-if="checked && mainStore.imageViewType === 'list'">
      <button class="icon-button" @click.stop="deleteItems(dataType, items, realAllChecked, finalQ)" v-tooltip="$t('delete')">
        <md-ripple />
        <i-material-symbols:delete-forever-outline-rounded />
      </button>
      <button class="icon-button" @click.stop="downloadItems(realAllChecked, finalQ)" v-tooltip="$t('download')">
        <md-ripple />
        <i-material-symbols:download-rounded />
      </button>
      <button class="icon-button" @click.stop="addToTags(realAllChecked, finalQ)" v-tooltip="$t('add_to_tags')">
        <md-ripple />
        <i-material-symbols:label-outline-rounded />
      </button>
    </template>
    <button class="icon-button" @click.stop="changeViewType" v-tooltip="$t(mainStore.imageViewType === 'list' ? 'view_as_grid' : 'view_as_list')">
      <md-ripple />
      <i-material-symbols:grid-view-outline-rounded v-if="mainStore.imageViewType === 'list'" />
      <i-material-symbols:table-rows-rounded v-if="mainStore.imageViewType === 'grid'" />
    </button>
    <button class="icon-button" @click.prevent="upload" v-tooltip="$t('upload')">
      <md-ripple />
      <i-material-symbols:upload-rounded />
    </button>
    <search-input ref="searchInputRef" v-model="q" :search="doSearch">
      <template #filters>
        <div class="filters">
          <md-outlined-text-field :label="$t('keywords')" v-model="filter.text" keyup.enter="applyAndDoSearch" />
          <label class="form-label">{{ $t('tags') }}</label>
          <md-chip-set>
            <md-filter-chip v-for="item in tags" :key="item.id" :label="item.name" :selected="filter.tags.includes(item)" @click="onTagSelect(item)" />
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
  <div class="image-container" v-if="mainStore.imageViewType === 'grid'" style="margin-bottom: 24px">
    <div class="item" v-for="(item, i) in sources" @click="view(i)" @contextmenu="itemCtxMenu($event, item.data)">
      <img class="image" :src="item.src + '&w=300&h=300'" />
      <span class="duration">{{ formatFileSize(item.size) }}</span>
    </div>
  </div>
  <all-checked-alert :limit="limit" :total="total" :all-checked-alert-visible="allCheckedAlertVisible" :real-all-checked="realAllChecked" :select-real-all="selectRealAll" :clear-selection="clearSelection" />
  <div class="table-responsive" v-if="mainStore.imageViewType === 'list'">
    <table class="table">
      <thead>
        <tr>
          <th>
            <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
          </th>
          <th>ID</th>
          <th></th>
          <th>{{ $t('name') }}</th>
          <th></th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('file_size') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, i) in items" :key="item.id" :class="{ selected: item.checked }" @click.stop="toggleRow(item)">
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td><field-id :id="item.id" :raw="item" /></td>
          <td>
            <img :src="getFileUrl(item.fileId) + '&w=300&h=300'" width="50" height="50" @click.stop="view(i)" style="cursor: pointer" />
          </td>
          <td>
            {{ getFileName(item.path) }}
          </td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="icon-button" @click.stop="deleteItem(dataType, item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button class="icon-button" @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))" v-tooltip="$t('download')">
                <md-ripple />
                <i-material-symbols:download-rounded />
              </button>
              <button class="icon-button" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
            </div>
          </td>
          <td>
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            {{ formatFileSize(item.size) }}
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td colspan="7">
            <div class="no-data-placeholder">
              {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="no-data-placeholder" v-if="mainStore.imageViewType === 'grid' && sources.length === 0">
    {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
  </div>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { computed } from 'vue'
import { imagesGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute, useRouter } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { getFileId, getFileUrl } from '@/lib/api/file'
import { formatFileSize } from '@/lib/format'
import type { IFilter, IImageItem, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMediaItemsDeletedEvent, ITag } from '@/lib/interfaces'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import { useAddToTags, useTags } from './hooks/tags'
import { getFileName } from '@/lib/api/file'
import { useSelectable } from './hooks/list'
import { useDeleteItems } from './hooks/media'
import { useDownload, useDownloadItems } from './hooks/files'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'
import type { ISource } from '@/components/lightbox/types'
import { remove } from 'lodash-es'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { contextmenu } from '@/components/contextmenu'

const router = useRouter()
const mainStore = useMainStore()
const items = ref<IImageItem[]>([])
const searchInputRef = ref()
const { t } = useI18n()
const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const dataType = DataType.IMAGE
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 48
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(dataType, q, filter, async (fields: IFilterField[]) => {
  finalQ.value = buildQuery(fields)
  await nextTick()
  load()
})
const { addToTags } = useAddToTags(dataType, items, tags)
const { deleteItems, deleteItem } = useDeleteItems()
const { allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleItemChecked, toggleRow, total, checked } = useSelectable(items)
const { downloadItems } = useDownloadItems(urlTokenKey, dataType, items, clearSelection, 'images.zip')
const { downloadFile } = useDownload(urlTokenKey)

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

const { loading, load, refetch } = initLazyQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        const list = []
        for (const item of data.images) {
          list.push({ ...item, checked: false, fileId: getFileId(urlTokenKey.value, item.path) })
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
    query: finalQ.value,
  }),
  appApi: true,
})

function updateUrl() {
  replacePath(mainStore, `/images?page=${page.value}&q=${encodeBase64(q.value)}`)
}

watch(page, () => {
  updateUrl()
})

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
  replacePath(mainStore, `/images?q=${encodeBase64(q.value)}`)
}

function changeViewType() {
  if (mainStore.imageViewType === 'grid') {
    mainStore.imageViewType = 'list'
  } else {
    mainStore.imageViewType = 'grid'
  }
}

function upload() {
  router.push(`/files`)
  pushModal(ConfirmModal, {
    message: t('upload_images'),
  })
}

function itemCtxMenu(e: MouseEvent, item: IImageItem) {
  e.preventDefault()
  contextmenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: t('add_to_tags'),
        onClick: () => {
          addItemToTags(item)
        },
      },
      {
        label: t('download'),
        onClick: () => {
          downloadFile(item.path, getFileName(item.path).replace(' ', '-'))
        },
      },
      {
        label: t('delete'),
        onClick: () => {
          deleteItem(dataType, item)
        },
      },
    ],
  })
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

onMounted(() => {
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('media_item_deleted', mediaItemDeletedHandler)
  emitter.on('media_items_deleted', mediaItemsDeletedHandler)
})

onUnmounted(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('media_item_deleted', mediaItemDeletedHandler)
  emitter.off('media_items_deleted', mediaItemsDeletedHandler)
})
</script>

<style lang="scss" scoped>
.image-container {
  .item {
    width: calc(16.66% - 4px);
    margin: 2px;
  }
}
</style>
