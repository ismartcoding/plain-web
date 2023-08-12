<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.audios')} (${total})`" />
    <div class="right-actions">
      <template v-if="checked">
        <button type="button" class="btn btn-action" @click.stop="deleteItems" :title="$t('delete')">
          <i-material-symbols:delete-outline-rounded class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="downloadItems" :title="$t('download')">
          <i-material-symbols:download-rounded class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="addItemsToPlaylist" :title="$t('add_to_playlist')">
          <i-material-symbols:playlist-add class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="addToTags" :title="$t('add_to_tags')">
          <i-material-symbols:label-outline-rounded class="bi" />
        </button>
        <button type="button" class="btn btn-action" @click.stop="removeFromTags" :title="$t('remove_from_tags')">
          <i-material-symbols:label-off-outline-rounded class="bi" />
        </button>
      </template>
      <button type="button" class="btn btn-action" @click.stop="upload">{{ $t('upload') }}</button>
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
  <table class="table">
    <thead>
      <tr>
        <th><input class="form-check-input" type="checkbox" @change="toggleSelect" v-model="selectAll" /></th>
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
        :class="{ checked: item.checked }"
        @click.stop="item.checked = !item.checked"
      >
        <td><input class="form-check-input" type="checkbox" v-model="item.checked" /></td>
        <td><field-id :id="item.id" :raw="item" /></td>
        <td>
          {{ item.title }}
        </td>
        <td class="nowrap">
          <span class="audio-btns">
            <i-material-symbols:delete-outline-rounded class="bi bi-btn" @click.stop="deleteItem(item)" />
            <i-material-symbols:download-rounded
              class="bi bi-btn"
              @click.stop="downloadFile(item.path, getFileName(item.path).replace(' ', '-'))"
            />
            <i-material-symbols:playlist-add class="bi bi-btn" @click.stop="addToPlaylist(item)" />
            <i class="spinner spinner-sm" v-if="playLoading && item.path === playing"></i>
            <i-material-symbols:play-circle-outline-rounded class="bi bi-btn" v-else @click.stop="play(item)" />
          </span>
        </td>
        <td>
          {{ item.artist }}
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
        <td colspan="8">
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
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatSeconds } from '@/lib/format'
import { audiosGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute, useRouter } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { formatFileSize } from '@/lib/format'
import type { IAudio, IPlaylistAudio, IAudioItem, IFilter } from '@/lib/interfaces'
import { storeToRefs } from 'pinia'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useAddToPlaylist, usePlay } from './hooks/audios'
import { useSelectable } from './hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags, useRemoveFromTags, useTags } from './hooks/tags'
import { useDeleteItems } from './hooks/media'
import { useDownload, useDownloadItems } from './hooks/files'
import { openModal, pushModal } from '@/components/modal'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { getFileName } from '@/lib/api/file'
import { deleteMediaItemGQL } from '@/lib/api/mutation'
import DeleteConfirm from '@/components/DeleteConfirm.vue'

const mainStore = useMainStore()
const items = ref<IAudioItem[]>([])
const { t } = useI18n()
const { app } = storeToRefs(useTempStore())
const filter: IFilter = reactive({
  text: '',
  tags: [],
})
const audios = computed<IPlaylistAudio[]>(() => {
  return (app.value as any).audios ?? []
})

const current = computed<IPlaylistAudio | undefined>(() => {
  const c = (app.value as any).audioCurrent
  return audios.value.find((it) => it.path == c)
})

const checked = computed<boolean>(() => {
  return items.value.some((it) => it.checked)
})

const tagType = 'AUDIO'
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const total = ref(0)
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(tagType, q, filter, async (fields: IFilterField[]) => {
  finalQ.value = buildQuery(fields)
  await nextTick() // hack: to fix the lazy query load twice
  load()
})
const { addItemsToPlaylist, addToPlaylist } = useAddToPlaylist(items)
const { addToTags } = useAddToTags(tagType, items, tags)
const { removeFromTags } = useRemoveFromTags(tagType, items, tags)
const { deleteItems } = useDeleteItems(tagType, items)
const { downloadItems } = useDownloadItems(items, 'audios.zip')
const { downloadFile } = useDownload(app)

const router = useRouter()

const { play, playing, loading: playLoading } = usePlay()

const { selectAll, toggleSelect } = useSelectable(items)
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

function applyAndDoSearch() {
  q.value = buildFilterQuery(filter)
  doSearch()
}

function doSearch() {
  replacePath(mainStore, `/audios?q=${encodeBase64(q.value)}`)
}

onMounted(() => {
  emitter.on('refetch_by_tag_type', (type: string) => {
    if (type === tagType) {
      refetch()
    }
  })
})

function deleteItem(item: any) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.title,
    gql: deleteMediaItemGQL,
    variables: () => ({ tagType: tagType, id: item.id }),
    appApi: true,
    typeName: 'Audio',
    done: () => {
      emitter.emit('refetch_app')
      emitter.emit('refetch_by_tag_type', tagType)
    },
  })
}
</script>
<style lang="scss" scoped>
.audio-btns {
  padding-left: 8px;
  .spinner {
    margin-left: 10px;
  }
}
</style>
