<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.notes') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <template v-if="filter.trash">
          <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItems(selectedIds, realAllChecked, total, q)">
            <i-material-symbols:delete-forever-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('restore')" :loading="restoreLoading(getQuery())" @click.stop="restore(getQuery())">
            <i-material-symbols:restore-from-trash-outline-rounded />
          </v-icon-button>
        </template>
        <template v-else>
          <v-icon-button v-tooltip="$t('move_to_trash')" @click.stop="trash(getQuery())">
            <i-material-symbols:delete-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addToTags(selectedIds, realAllChecked, q)">
            <i-material-symbols:label-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('export_notes')" @click.stop="exportNotes2">
            <i-material-symbols:export-notes-outline-rounded />
          </v-icon-button>
        </template>
      </template>
    </div>
    <div class="actions">
      <v-outlined-button v-if="!filter.trash" class="btn-sm" @click.prevent="create">{{ $t('create') }}</v-outlined-button>
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
  <div v-if="loading && items.length === 0" class="scroller main-list">
    <NoteSkeletonItem v-for="i in 20" :key="i" :index="i" :is-phone="isPhone" />
  </div>
  <VirtualList v-if="items.length" class="scroller main-list" :data-key="'id'" :data-sources="items" :estimate-size="100" :class="{ 'select-mode': checked }">
    <template #item="{ index, item }">
      <a :key="item.id" class="item-link" :href="viewUrl(item)">
        <NoteListItem
          :item="item"
          :index="index"
          :selected-ids="selectedIds"
          :shift-effecting-ids="shiftEffectingIds"
          :should-select="shouldSelect"
          :is-phone="isPhone"
          :filter="filter"
          :data-type="dataType"
          :route-id="$route.params['id'] as string"
          :handle-item-click="handleItemClick"
          :handle-mouse-over="handleMouseOver"
          :toggle-select="toggleSelect"
          :view="view"
          :delete-item="deleteItem"
          :add-item-to-tags="addItemToTags"
          :restore-loading="restoreLoading"
          :trash-loading="trashLoading"
          :restore="restore"
          :trash="trash"
        />
      </a>
    </template>
    <template #footer>
      <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
    </template>
  </VirtualList>
  <div v-if="!loading && items.length === 0" class="no-data-placeholder">
    {{ $t(noDataKey(loading)) }}
  </div>
</template>

<script setup lang="ts">
import { inject, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatTimeAgo, formatDateTime } from '@/lib/format'
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
import { deleteNotesGQL, exportNotesGQL, initMutation } from '@/lib/api/mutation'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import gql from 'graphql-tag'
import { DataType } from '@/lib/data'
import { getSummary } from '@/lib/strutil'
import { useSearch } from '@/hooks/search'
import { truncate } from 'lodash-es'
import { useKeyEvents } from '@/hooks/key-events'
import VirtualList from '@/components/virtualscroll'
import { downloadFromString } from '@/lib/api/file'
import { useNotesRestore, useNotesTrash } from '@/hooks/notes'
import NoteListItem from '@/components/notes/NoteListItem.vue'

const isPhone = inject('isPhone') as boolean
const mainStore = useMainStore()
const items = ref<INote[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
  trash: false,
})
const dataType = DataType.NOTE
const route = useRoute()
const page = ref(1)
const limit = 50
const q = ref('')
const { tags, fetch: fetchTags } = useTags(dataType)
const {
  selectedIds,
  allChecked,
  realAllChecked,
  selectRealAll,
  allCheckedAlertVisible,
  clearSelection,
  toggleAllChecked,
  toggleSelect,
  total,
  checked,
  shiftEffectingIds,
  handleItemClick,
  handleMouseOver,
  selectAll,
  shouldSelect,
} = useSelectable(items)
const { addToTags } = useAddToTags(dataType, tags)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/notes?page=${page}&q=${q}` : `/notes?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  deleteItems(selectedIds.value, realAllChecked.value, total.value, q.value)
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
    query: q.value,
  }),
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


const { mutate: exportNotes, onDone: onExpored } = initMutation({
  document: exportNotesGQL,
})

const exportNotes2 = () => {
  exportNotes({ query: getQuery() })
}

const getQuery = () => {
  let query = q.value
  if (!realAllChecked.value) {
    query = `ids:${selectedIds.value.join(',')}`
  }
  return query
}

onExpored((r: any) => {
  downloadFromString(r.data.exportNotes, 'application/json', 'notes.json')
})

const { deleteItems } = useDelete(deleteNotesGQL, () => {
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
    typeName: 'Note',
  })
}

const { trashLoading, trash } = useNotesTrash(clearSelection, fetch)
const { restoreLoading, restore } = useNotesRestore(clearSelection, fetch)

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

const isActive = ref(false)

function applyRouteQuery() {
  const nextPage = parseInt(route.query.page?.toString() ?? '1')
  page.value = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
  q.value = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q.value)
  // trash field is required
  if (filter.trash === undefined) {
    filter.trash = false
  }
  fetch()
}

watch(
  () => route.fullPath,
  () => {
    if (!isActive.value) return
    applyRouteQuery()
  }
)

onActivated(() => {
  fetchTags()
  isActive.value = true
  applyRouteQuery()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  isActive.value = false
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

:deep(.note-item) {
  margin-block-end: 8px;
  grid-template-areas:
    'start title actions time'
    'start subtitle actions time';
  grid-template-columns: 48px 2fr 100px minmax(100px, 1fr);
  &:hover {
    cursor: pointer;
  }
  .title {
    grid-area: title;
    font-weight: normal;
    margin-inline-end: 16px;
    padding-block-start: 12px;
  }
  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.875rem;
    margin-inline-end: 16px;
    margin-block-end: 12px;
    margin-block-start: 8px;
  }
  .time {
    grid-area: time;
    display: flex;
    align-items: center;
    padding-inline: 16px;
    justify-content: end;
  }
}
</style>
