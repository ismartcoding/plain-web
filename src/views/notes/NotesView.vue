<template>
  <div class="top-app-bar">
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.notes') }} ({{ total.toLocaleString() }})</span>
      <template v-if="filter.trash">
        <template v-if="checked">
          <button class="btn-icon" @click.stop="deleteItems(realAllChecked, selectedIds, q)" v-tooltip="$t('delete')">
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
          <button class="btn-icon" @click.stop="addToTags(selectedIds, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
            <md-ripple />
            <i-material-symbols:label-outline-rounded />
          </button>
        </template>
      </template>
    </div>
    <div class="actions">
      <search-input :filter="filter" :tags="tags" :get-url="getUrl" :show-trash="true" />
      <md-outlined-button v-if="!filter.trash" class="btn-sm" @click.prevent="create">{{ $t('create') }}</md-outlined-button>
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

  <VirtualList class="scroller" :data-key="'id'" :data-sources="items" :estimate-size="100">
    <template #item="{ index, item }">
      <a class="item-link" :href="viewUrl(item)" @click.stop.prevent="view(item)">
        <article class="card note-item" :class="{ selected: item.id == $route.params['id'] }">
          <div class="grid1">
            <div class="title">{{ getSummary(item.title.split('\n')[0].trimStart()) || $t('meta_no_title') }}</div>
          </div>
          <div class="grid2">
            <div class="subtitle">
              <span>{{ index + 1 }}&nbsp;&nbsp;·&nbsp;&nbsp;</span>
              <span class="time" v-tooltip="formatDateTime(item.updatedAt)">
                {{ formatTimeAgo(item.updatedAt) }}
              </span>
              <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
            </div>
          </div>
        </article>
      </a>
    </template>
    <template #footer>
      <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
    </template>
  </VirtualList>

  <div class="table-responsive" style="display: none">
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
        <tr v-for="(item, i) in items" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click.stop="toggleRow($event, item, i)">
          <td><md-checkbox touch-target="wrapper" @change="toggleRow($event, item, i)" :checked="selectedIds.includes(item.id)" /></td>
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
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'
import { formatTimeAgo, formatDateTime, formatDateTimeFull } from '@/lib/format'
import { notesGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import type { INote, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IFilter } from '@/lib/interfaces'
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
import { useKeyEvents } from '@/hooks/key-events'
import VirtualList from '@/components/virtualscroll'

const mainStore = useMainStore()
const tempStore = useTempStore()
const { app } = storeToRefs(tempStore)
const items = ref<INote[]>([])
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
const { selectedIds, allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleRow, total, checked, selectAll } = useSelectable(items)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/notes?page=${page}&q=${q}` : `/notes?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  deleteItems(realAllChecked.value, selectedIds.value, q.value)
})

const { loading, fetch } = initLazyQuery({
  handle: (data: { notes: INote[]; noteCount: number }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.notes
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

function addItemToTags(item: INote) {
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

function getUrl(q: string) {
  return q ? `/notes?q=${q}` : `/notes`
}

const { mutate: trashNotes, onDone: onTrash } = initMutation({
  document: trashNotesGQL,
  appApi: true,
})

function moveToTrash() {
  if (selectedIds.value.length === 0) {
    toast(t('select_first'), 'error')
    return
  }
  trashNotes({ query: `ids:${selectedIds.value.join(',')}` })
}

const { deleteItems } = useDelete(deleteNotesGQL, () => {
  clearSelection()
  fetch()
})

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
  if (selectedIds.value.length === 0) {
    toast(t('select_first'), 'error')
    return
  }
  untrashNotes({ query: `ids:${selectedIds.value.join(',')}` })
}

onRestored(() => {
  clearSelection()
  fetch()
})

function deleteItem(item: INote) {
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
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
<style lang="scss" scoped>
.scroller {
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100vh - 112px);
  .item-link {
    text-decoration: none;
    display: block;
  }
}
</style>
