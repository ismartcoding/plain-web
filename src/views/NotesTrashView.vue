<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.trash')} (${total})`" />
    <template v-if="checked">
      <button class="icon-button" @click.stop="deleteItems(realAllChecked, finalQ)" v-tooltip="$t('delete')">
        <md-ripple />
        <i-material-symbols:delete-forever-outline-rounded />
      </button>
      <button class="icon-button" @click.stop="untrash" v-tooltip="$t('restore')">
        <md-ripple />
        <i-material-symbols:restore-from-trash-outline-rounded />
      </button>
    </template>
    <search-input ref="searchInputRef" v-model="q" :search="doSearch">
      <template #filters>
        <div class="filters">
          <md-outlined-text-field :label="$t('keywords')" v-model="filter.text" keyup.enter="applyAndDoSearch" />
          <label class="form-label">{{ $t('tags') }}</label>
          <md-chip-set>
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
          <th>{{ $t('title') }}</th>
          <th></th>
          <th>{{ $t('updated_at') }}</th>
          <th>{{ $t('created_at') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" :class="{ selected: item.checked }" @click.stop="toggleRow(item)">
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td><field-id :id="item.id" :raw="item" /></td>
          <td>
            <a href="#" @click.stop.prevent="view(item)">{{ item.title || $t('no_content') }}</a>
          </td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="icon-button" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button
                class="icon-button"
                @click.stop="untrashNotes({ query: `ids:${item.id}` })"
                v-tooltip="$t('restore')"
              >
                <md-ripple />
                <i-material-symbols:restore-from-trash-outline-rounded />
              </button>
            </div>
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
  </div>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime } from '@/lib/format'
import { notesGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import type { INote, IFilter, INoteItem, ISelectable, ITag } from '@/lib/interfaces'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useSelectable } from './hooks/list'
import { useDelete } from './hooks/list'
import { deleteNotesGQL, initMutation, untrashNotesGQL } from '@/lib/api/mutation'
import { useTags } from './hooks/tags'
import { remove } from 'lodash-es'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import gql from 'graphql-tag'
import { DataType } from '@/lib/data'

const mainStore = useMainStore()
const items = ref<INoteItem[]>([])
const searchInputRef = ref()
const { t } = useI18n()
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const dataType = DataType.NOTE
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(dataType, q, filter, async (fields: IFilterField[]) => {
  fields.push({
    name: 'trash',
    op: '',
    value: 'true',
  })

  finalQ.value = buildQuery(fields)
  await nextTick()
  load()
})
const { deleteItems } = useDelete(
  deleteNotesGQL,
  () => {
    clearSelection()
    refetch()
  },
  items
)

const {
  allChecked,
  realAllChecked,
  selectRealAll,
  allCheckedAlertVisible,
  clearSelection,
  toggleAllChecked,
  toggleItemChecked,
  toggleRow,
  total,
  checked,
} = useSelectable(items)
const { loading, load, refetch } = initLazyQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.notes.map((it: INote) => ({ ...it, checked: false }))
        total.value = data.noteCount
      }
    }
  },
  document: notesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

watch(page, (value: number) => {
  replacePath(mainStore, `/notes/trash?page=${value}&q=${encodeBase64(q.value)}`)
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
  replacePath(mainStore, `/notes/trash?q=${encodeBase64(q.value)}`)
}

const { mutate: untrashNotes, onDone: onRestored } = initMutation({
  document: untrashNotesGQL,
  appApi: true,
})

function untrash() {
  const selectedItems = items.value.filter((it: ISelectable) => it.checked)
  if (selectedItems.length === 0) {
    toast(t('select_first'), 'error')
    return
  }
  untrashNotes({ query: `ids:${selectedItems.map((it: INote) => it.id).join(',')}` })
}

function view(item: INote) {
  router.push(`/notes/${item.id}`)
}

onRestored(() => {
  clearSelection()
  refetch()
})

function deleteItem(item: INoteItem) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.id,
    gql: gql`
      mutation DeleteNote($query: String!) {
        deleteNotes(query: $query)
      }
    `,
    variables: () => ({
      query: `ids:${item.id}`,
    }),
    done: () => {
      clearSelection()
      total.value--
    },
    appApi: true,
    typeName: 'Note',
  })
}
</script>
