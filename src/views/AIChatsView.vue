<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.aichats')} (${total})`" />
    <div class="right-actions">
      <button class="btn btn-action" type="button" @click.prevent="create">{{ $t('new_chat') }}</button>
      <dropdown :title="$t('actions')" :items="actionItems" />
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
        <th>{{ $t('content') }}</th>
        <th>{{ $t('tags') }}</th>
        <th>{{ $t('updated_at') }}</th>
        <th>{{ $t('created_at') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.id" :class="{ checked: item.checked }"
        @click.stop="item.checked = !item.checked">
        <td><input class="form-check-input" type="checkbox" v-model="item.checked" /></td>
        <td><field-id :id="item.id" :raw="item" /></td>
        <td>
          <a href="#" @click.stop="view(item)">{{ truncate(item.content, { length: 200, omission: '' }) }}</a>
        </td>
        <td>
          <span v-for="tag in item.tags" class="badge">{{ tag.name }}</span>
        </td>
        <td class="nowrap">
          {{ formatDateTime(item.updatedAt) }}
        </td>
        <td class="nowrap">
          {{ formatDateTime(item.createdAt) }}
        </td>
      </tr>
    </tbody>
    <tfoot v-if="!items.length">
      <tr>
        <td colspan="6">
          <div class="no-data-placeholder">
            {{ $t(noDataKey(loading)) }}
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
import { formatDateTime } from '@/lib/format'
import { aichatsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { pushPath, replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import type { IAIChatItem, IFilter, IDropdownItem } from '@/lib/interfaces'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useDelete, useSelectable } from './hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags, useRemoveFromTags, useTags } from './hooks/tags'
import { deleteAIChatsGQL } from '@/lib/api/mutation'
import { truncate } from 'lodash-es'

const mainStore = useMainStore()
const items = ref<IAIChatItem[]>([])
const { t } = useI18n()
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const tagType = 'AI_CHAT'
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const total = ref(0)
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(tagType, q, filter, async (fields: IFilterField[]) => {
  fields.push({ name: 'parent_id', op: '', value: '' })
  finalQ.value = buildQuery(fields)
  await nextTick()
  load()
})
const { addToTags } = useAddToTags(tagType, items, tags)
const { removeFromTags } = useRemoveFromTags(tagType, items, tags)
const { deleteItems } = useDelete(
  deleteAIChatsGQL,
  () => {
    refetch()
  },
  items
)
const actionItems: IDropdownItem[] = [
  { text: t('add_to_tags'), click: addToTags },
  { text: t('remove_from_tags'), click: removeFromTags },
  { text: t('delete'), click: deleteItems },
]

const { selectAll, toggleSelect } = useSelectable(items)
const { loading, load, refetch } = initLazyQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.aiChats.map((it: IAIChatItem) => ({ ...it, checked: false }))
        total.value = data.aiChatCount
      }
    }
  },
  document: aichatsGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

watch(page, (value: number) => {
  replacePath(mainStore, `/aichats?page=${value}&q=${encodeBase64(q.value)}`)
})

function applyAndDoSearch() {
  q.value = buildFilterQuery(filter)
  doSearch()
}

function doSearch() {
  replacePath(mainStore, `/aichats?q=${encodeBase64(q.value)}`)
}

onMounted(() => {
  emitter.on('refetch_by_tag_type', (type: string) => {
    if (type === tagType) {
      refetch()
    }
  })
})

function view(item: IAIChatItem) {
  pushPath(`/aichats/${item.id}`)
}

function create() {
  pushPath(`/aichats/create`)
}
</script>
