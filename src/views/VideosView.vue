<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.videos')} (${total})`" />
    <div class="right-actions">
      <template v-if="checked && viewType === 'list'">
        <button type="button" class="btn btn-action" @click.stop="deleteItems" :title="$t('delete')">
          <i-material-symbols:delete-outline-rounded class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="downloadItems" :title="$t('download')">
          <i-material-symbols:download-rounded class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="addToTags" :title="$t('add_to_tags')">
          <i-material-symbols:label-outline-rounded class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="removeFromTags" :title="$t('remove_from_tags')">
          <i-material-symbols:label-off-outline-rounded class="bi" />
        </button>
      </template>
      <button type="button" class="btn btn-action" @click.prevent="changeViewType">
        <i-material-symbols:grid-view-outline-rounded v-if="viewType === 'list'" class="bi" />
        <i-material-symbols:table-rows-rounded v-if="viewType === 'grid'" class="bi" />
      </button>
      <button type="button" class="btn btn-action" @click.prevent="upload">{{ $t('upload') }}</button>
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
      <span class="duration">{{ formatSeconds(item.duration) }}</span>
    </div>
  </div>
  <div class="no-data-placeholder" v-if="viewType === 'grid' && sources.length === 0">
    {{ $t(noDataKey(loading, app.permissions, 'WRITE_EXTERNAL_STORAGE')) }}
  </div>
  <table class="table" v-if="viewType === 'list'">
    <thead>
      <tr>
        <th><input class="form-check-input" type="checkbox" @change="toggleSelect" v-model="selectAll" /></th>
        <th>ID</th>
        <th></th>
        <th>{{ $t('name') }}</th>
        <th>{{ $t('tags') }}</th>
        <th>{{ $t('duration') }}</th>
        <th>{{ $t('file_size') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(item, i) in items"
        :key="item.id"
        :class="{ checked: item.checked }"
        @click.stop="item.checked = !item.checked"
      >
        <td><input class="form-check-input" type="checkbox" v-model="item.checked" /></td>
        <td><field-id :id="item.id" :raw="item" /></td>
        <td>
          <img
            class="img-video"
            :src="getFileUrl(item.fileId) + '&w=200&h=200'"
            width="50"
            height="50"
            @click.stop="view(i)"
          />
        </td>
        <td>
          {{ item.title }}
        </td>
        <td>
          <span v-for="tag in item.tags" class="badge">{{ tag.name }}</span>
        </td>
        <td>
          {{ formatSeconds(item.duration) }}
        </td>
        <td>
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
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatSeconds } from '@/lib/format'
import { computed } from 'vue'
import { videosGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute, useRouter } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import { getFileId, getFileUrl } from '@/lib/api/file'
import { formatFileSize } from '@/lib/format'
import type { IFilter, IVideoItem } from '@/lib/interfaces'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import { useAddToTags, useRemoveFromTags, useTags } from './hooks/tags'
import { getFileName } from '@/lib/file'
import { useSelectable } from './hooks/list'
import { useDeleteItems } from './hooks/media'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useDownloadItems } from './hooks/files'
import type { ISource } from '@/components/lightbox/types'

const router = useRouter()
const mainStore = useMainStore()
const items = ref<IVideoItem[]>([])
const { t } = useI18n()
const tempStore = useTempStore()
const { app } = storeToRefs(tempStore)
const filter: IFilter = reactive({
  text: '',
  tags: [],
})
const checked = computed<boolean>(() => {
  return items.value.some((it) => it.checked)
})
const tagType = 'VIDEO'
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
const { addToTags } = useAddToTags(tagType, items, tags)
const { removeFromTags } = useRemoveFromTags(tagType, items, tags)
const { deleteItems } = useDeleteItems(tagType, items)
const { downloadItems } = useDownloadItems(items, 'videos.zip')

const sources = computed<ISource[]>(() => {
  return items.value.map((it: IVideoItem) => ({
    src: getFileUrl(it.fileId),
    name: getFileName(it.path),
    duration: it.duration,
    size: it.size,
  })) as ISource[]
})

const { selectAll, toggleSelect } = useSelectable(items)
const { loading, load, refetch } = initLazyQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        const { fileIdToken } = app.value
        const list: IVideoItem[] = []
        for (const item of data.videos) {
          list.push({ ...item, checked: false, fileId: await getFileId(fileIdToken, item.path) })
        }
        items.value = list
        total.value = data.videoCount
      }
    }
  },
  document: videosGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

function updateUrl() {
  replacePath(mainStore, `/videos?page=${page.value}&q=${encodeBase64(q.value)}&view=${viewType.value}`)
}

function view(index: number) {
  tempStore.lightbox = {
    sources: sources.value,
    index: index,
    visible: true
  }
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
  replacePath(mainStore, `/videos?q=${encodeBase64(q.value)}&view=${viewType.value}`)
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
    message: t('upload_videos'),
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

.img-video:hover {
  cursor: pointer;
}
</style>
