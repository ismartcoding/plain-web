<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('page_title.notes') }} ({{ total.toLocaleString() }})</div>
    <div class="actions">
      <search-input :filter="filter" :tags="tags" :get-url="getUrl" :show-trash="true" />
      <template v-if="filter.trash">
        <template v-if="checked">
          <button class="btn-icon" @click.stop="deleteItems(realAllChecked, q)" v-tooltip="$t('delete')">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
          <button class="btn-icon" @click.stop="untrash" v-tooltip="$t('restore')">
            <md-ripple />
            <i-material-symbols:restore-from-trash-outline-rounded />
          </button>
        </template>
      </template>
      <template v-else>
        <template v-if="checked">
          <button class="btn-icon" @click.stop="moveToTrash" v-tooltip="$t('move_to_trash')">
            <md-ripple />
            <i-material-symbols:delete-outline-rounded />
          </button>
          <button class="btn-icon" @click.stop="addToTags(items, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
            <md-ripple />
            <i-material-symbols:label-outline-rounded />
          </button>
          <md-outlined-button @click.prevent="create">{{ $t('create') }}</md-outlined-button>
        </template>
      </template>
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
          <th>{{ $t('title') }}</th>
          <th></th>
          <th v-if="!filter.trash">{{ $t('tags') }}</th>
          <th>{{ $t('updated_at') }}</th>
          <th>{{ $t('created_at') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" :class="{ selected: item.checked }" @click.stop="toggleRow(item)">
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td v-if="app.developerMode"><field-id :id="item.id" :raw="item" /></td>
          <td style="min-width: 200px; cursor: pointer" @click.stop.prevent="view(item)">
            <a style="text-overflow: clip" :href="viewUrl(item)" @click.stop.prevent="view(item)">
              {{ getSummary(item.title.split('\n')[0].trimStart()) || $t('meta_no_title') }}
            </a>
          </td>
          <td class="nowrap">
            <div class="action-btns" v-if="filter.trash">
              <button class="btn-icon sm" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button class="btn-icon sm" @click.stop="untrashNotes({ query: `ids:${item.id}` })" v-tooltip="$t('restore')">
                <md-ripple />
                <i-material-symbols:restore-from-trash-outline-rounded />
              </button>
            </div>
            <div class="action-btns" v-else>
              <button class="btn-icon sm" @click.stop="trashNotes({ query: `ids:${item.id}` })" v-tooltip="$t('move_to_trash')">
                <md-ripple />
                <i-material-symbols:delete-outline-rounded />
              </button>
              <button class="btn-icon sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
            </div>
          </td>
          <td v-if="!filter.trash">
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            <time v-tooltip="formatDateTimeFull(item.updatedAt)">{{ formatDateTime(item.updatedAt) }}</time>
          </td>
          <td class="nowrap">
            <time v-tooltip="formatDateTimeFull(item.createdAt)">{{ formatDateTime(item.createdAt) }}</time>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td :colspan="colspan">
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
import { computed, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { notesGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import type { INote, INoteItem, ISelectable, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IFilter } from '@/lib/interfaces'
import { decodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useDelete, useSelectable } from '@/hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags, useTags } from '@/hooks/tags'
import { deleteNotesGQL, initMutation, trashNotesGQL, untrashNotesGQL } from '@/lib/api/mutation'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import gql from 'graphql-tag'
import { DataType } from '@/lib/data'
import { getSummary } from '@/lib/strutil'
import { useSearch } from '@/hooks/search'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { truncate } from 'lodash-es'

const mainStore = useMainStore()
const tempStore = useTempStore()
const { app } = storeToRefs(tempStore)
const items = ref<INoteItem[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
  trash: false,
})
const dataType = DataType.NOTE
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref('')
const { tags, fetch: fetchTags } = useTags(dataType)

const { addToTags } = useAddToTags(dataType, tags)

const { allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleItemChecked, toggleRow, total, checked } = useSelectable(items)
const { loading, fetch } = initLazyQuery({
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
    query: q.value ? q.value : 'trash:false',
  }),
  appApi: true,
})

function addItemToTags(item: INoteItem) {
  openModal(UpdateTagRelationsModal, {
    type: dataType,
    tags: tags.value,
    item: {
      key: item.id,
      title: '',
      size: 0,
    },
    selected: tags.value.filter((it) => item.tags.some((t) => t.id === it.id)),
  })
}

const colspan = computed(() => {
  if (filter.trash) {
    return app.value.developerMode ? 6 : 5
  }

  return app.value.developerMode ? 7 : 6
})

watch(page, (value: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/notes?page=${value}&q=${q}` : `/notes?page=${value}`)
})

function getUrl(q: string) {
  return q ? `/notes?q=${q}` : `/notes`
}

const { mutate: trashNotes, onDone: onTrash } = initMutation({
  document: trashNotesGQL,
  appApi: true,
})

function moveToTrash() {
  const selectedItems = items.value.filter((it: ISelectable) => it.checked)
  if (selectedItems.length === 0) {
    toast(t('select_first'), 'error')
    return
  }
  trashNotes({ query: `ids:${selectedItems.map((it: INote) => it.id).join(',')}` })
}

const { deleteItems } = useDelete(
  deleteNotesGQL,
  () => {
    clearSelection()
    fetch()
  },
  items
)

onTrash(() => {
  clearSelection()
  fetch()
  if (items.value.some((it) => it.tags.length)) {
    emitter.emit('refetch_tags', dataType)
  }
})

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

onRestored(() => {
  clearSelection()
  fetch()
})

function deleteItem(item: INoteItem) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: truncate(item.title, { length: 20 }),
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

function view(item: INote) {
  replacePath(mainStore, viewUrl(item))
}

function viewUrl(item: INote) {
  const q = router.currentRoute.value.query.q
  if (q) {
    return `/notes/${item.id}?q=${q}`
  }

  return `/notes/${item.id}`
}

function create() {
  router.push(`/notes/create`)
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

onActivated(() => {
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
  // trash field is required
  if (filter.trash === undefined) {
    filter.trash = false
  }
  fetchTags()
  fetch()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
})
</script>
