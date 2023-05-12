<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.images')} (${total})`" />
    <div class="right-actions">
      <button type="button" class="btn btn-action" @click.stop="changeViewType">
        <i-material-symbols:grid-view-outline-rounded v-if="viewType === 'list'" class="bi" />
        <i-material-symbols:table-rows-rounded v-if="viewType === 'grid'" class="bi" />
      </button>
      <button type="button" class="btn btn-action" @click.stop="upload">{{ $t('upload') }}</button>
      <dropdown :title="$t('actions')" :items="actionItems" v-if="viewType === 'list'" />

      <search-input v-model="q" :search="doSearch">
        <template #filters>
          <div class="row mb-3">
            <label class="col-md-3 col-form-label">{{ $t('keywords') }}</label>
            <div class="col-md-9">
              <input type="text" v-model="filter.text" class="form-control" @keyup.enter="applyAndDoSearch" />
            </div>
          </div>
          <div class="row mb-3">
            <label class="col-md-3 col-form-label">{{ $t('tags') }}</label>
            <div class="col-md-9">
              <multiselect v-model="filter.tags" label="name" track-by="id" :options="tags" />
            </div>
          </div>
          <div class="actions">
            <button type="button" class="btn" @click.stop="applyAndDoSearch">
              {{ $t('search') }}
            </button>
          </div>
        </template>
      </search-input>
    </div>
  </div>
  <div class="row row-cols-6 g-1" v-if="viewType === 'grid'" style="margin-bottom: 24px">
    <div class="col" v-for="(item, i) in sources" @click="view(i)">
      <img class="image" :src="item.src + '&w=200&h=200'" />
      <span class="duration">{{ formatFileSize(item.size) }}</span>
    </div>
  </div>
  <table class="table" v-if="viewType === 'list'">
    <thead>
      <tr>
        <th><input class="form-check-input" type="checkbox" @change="toggleSelect" v-model="selectAll" /></th>
        <th>ID</th>
        <th></th>
        <th>{{ $t('name') }}</th>
        <th>{{ $t('tags') }}</th>
        <th>{{ $t('file_size') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(item, i) in items" :key="item.id" :class="{ checked: item.checked }"
        @click.stop="item.checked = !item.checked">
        <td><input class="form-check-input" type="checkbox" v-model="item.checked" /></td>
        <td><field-id :id="item.id" :raw="item" /></td>
        <td>
          <img :src="getFileUrl(item.fileId) + '&w=200&h=200'" width="50" height="50" @click.stop="view(i)" />
        </td>
        <td>
          {{ getFileName(item.path) }}
        </td>
        <td>
          <span v-for="tag in item.tags" class="badge">{{ tag.name }}</span>
        </td>
        <td>
          {{ formatFileSize(item.size) }}
        </td>
      </tr>
    </tbody>
    <tfoot v-if="!items.length">
      <tr>
        <td colspan="6">
          <div class="no-data-placeholder">
            {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
          </div>
        </td>
      </tr>
    </tfoot>
  </table>
  <div class="no-data-placeholder" v-if="viewType === 'grid' && sources.length === 0">
    {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
  </div>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
  <lightbox :visible="visible" :index="index" :sources="sources" @hide="hide" />
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { computed } from 'vue'
import { imagesGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute, useRouter } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { getFileId, getFileUrl } from '@/lib/api/file'
import { useMediaViewer } from '@/components/lightbox/use'
import { formatFileSize } from '@/lib/format'
import type { IDropdownItem, IFilter, IImageItem } from '@/lib/interfaces'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import { useAddToTags, useRemoveFromTags, useTags } from './hooks/tags'
import { getFileName } from '@/lib/file'
import { useSelectable } from './hooks/list'
import { useDeleteItems } from './hooks/media'
import { useDownloadItems } from './hooks/files'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'

const router = useRouter()
const mainStore = useMainStore()
const items = ref<IImageItem[]>([])
const { t } = useI18n()
const { app } = storeToRefs(useTempStore())
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const tagType = 'IMAGE'
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 54
const total = ref(0)
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(tagType, q, filter, async (fields: IFilterField[]) => {
  finalQ.value = buildQuery(fields)
  await nextTick()
  load()
})
const viewType = ref(query.view?.toString() ?? 'grid')
const { visible, index, view, hide } = useMediaViewer()
const { addToTags } = useAddToTags(tagType, items, tags)
const { removeFromTags } = useRemoveFromTags(tagType, items, tags)
const { deleteItems } = useDeleteItems(tagType, items)
const { downloadItems } = useDownloadItems(items, 'images.zip')

const sources = computed(() => {
  return items.value.map((it: IImageItem) => ({
    src: getFileUrl(it.fileId),
    name: getFileName(it.path),
    duration: 0,
    size: it.size,
  }))
})

const actionItems: IDropdownItem[] = [
  { text: t('add_to_tags'), click: addToTags },
  { text: t('remove_from_tags'), click: removeFromTags },
  { text: t('download'), click: downloadItems },
  { text: t('delete'), click: deleteItems },
]

const { selectAll, toggleSelect } = useSelectable(items)
const { loading, load, refetch } = initLazyQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        const { fileIdToken } = app.value
        const list = []
        for (const item of data.images) {
          list.push({ ...item, checked: false, fileId: await getFileId(fileIdToken, item.path) })
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
  replacePath(mainStore, `/images?page=${page.value}&q=${encodeBase64(q.value)}&view=${viewType.value}`)
}

watch(page, () => {
  updateUrl()
})

watch(viewType, () => {
  updateUrl()
})

function applyAndDoSearch() {
  q.value = buildFilterQuery(filter)
  doSearch()
}

function doSearch() {
  replacePath(mainStore, `/images?q=${encodeBase64(q.value)}&view=${viewType.value}`)
}

function changeViewType() {
  if (viewType.value === 'grid') {
    viewType.value = 'list'
  } else {
    viewType.value = 'grid'
  }
}

function upload() {
  router.push(`/files`)
  pushModal(ConfirmModal, {
    message: t('upload_images'),
  })
}

onMounted(() => {
  emitter.on('refetch_by_tag_type', (type: string) => {
    if (type === tagType) {
      refetch()
    }
  })
})
</script>

<style lang="scss" scoped>
.col {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  position: relative;
}

.duration {
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 12px;
  padding: 1px 4px;
}
</style>
