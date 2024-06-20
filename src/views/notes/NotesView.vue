<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.notes') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <template v-if="filter.trash">
          <icon-button @click.stop="deleteItems(selectedIds, realAllChecked, total, q)" v-tooltip="$t('delete')">
            <template #icon>
              <i-material-symbols:delete-forever-outline-rounded />
            </template>
          </icon-button>
          <icon-button @click.stop="restore(getQuery())" v-tooltip="$t('restore')" :loading="restoreLoading(getQuery())">
            <template #icon>
              <i-material-symbols:restore-from-trash-outline-rounded />
            </template>
          </icon-button>
        </template>
        <template v-else>
          <icon-button @click.stop="trash(getQuery())" v-tooltip="$t('move_to_trash')">
            <template #icon>
              <i-material-symbols:delete-outline-rounded />
            </template>
          </icon-button>
          <icon-button @click.stop="addToTags(selectedIds, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
            <template #icon>
              <i-material-symbols:label-outline-rounded />
            </template>
          </icon-button>
          <icon-button @click.stop="exportNotes2" v-tooltip="$t('export_notes')">
            <template #icon>
              <i-material-symbols:export-notes-outline-rounded />
            </template>
          </icon-button>
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
  <div v-if="loading && items.length === 0" class="scroller">
    <article class="note-item selectable-card-skeleton" v-for="i in 20" :key="i">
      <div class="start">
        <div class="checkbox">
          <div class="skeleton-checkbox"></div>
        </div>
        <span class="number">{{ i }}</span>
      </div>
      <div class="title">
        <div class="skeleton-text skeleton-title"></div>
      </div>
      <div class="subtitle">
        <div class="skeleton-text skeleton-subtitle"></div>
      </div>
      <div class="actions">
        <div class="skeleton-text skeleton-actions"></div>
      </div>
      <div class="time">
        <div class="skeleton-text skeleton-time"></div>
      </div>
    </article>
  </div>
  <VirtualList v-if="items.length" class="scroller" :data-key="'id'" :data-sources="items" :estimate-size="100" :class="{ 'select-mode': checked }">
    <template #item="{ index, item }">
      <a class="item-link" :key="item.id" :href="viewUrl(item)">
        <article
          class="note-item selectable-card"
          :class="{ selected: selectedIds.includes(item.id) || item.id == $route.params['id'], selecting: shiftEffectingIds.includes(item.id) }"
          @click.stop.prevent="
            handleItemClick($event, item, index, () => {
              view(item)
            })
          "
          @mouseover="handleMouseOver($event, index)"
        >
          <div class="start">
            <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, index)" :checked="shouldSelect" />
            <md-checkbox v-else class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, index)" :checked="selectedIds.includes(item.id)" />
            <span class="number"><field-id :id="index + 1" :raw="item" /></span>
          </div>
          <div class="title">{{ getSummary(item.title.split('\n')[0].trimStart()) || $t('meta_no_title') }}</div>
          <div class="subtitle">
            <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
          </div>
          <div class="actions">
            <template v-if="filter.trash">
              <icon-button class="sm" @click.stop.prevent="deleteItem(item)" v-tooltip="$t('delete')">
                <template #icon>
                  <i-material-symbols:delete-forever-outline-rounded />
                </template>
              </icon-button>
              <icon-button class="sm" @click.stop.prevent="restore(`ids:${item.id}`)" v-tooltip="$t('restore')" :loading="restoreLoading(`ids:${item.id}`)">
                <template #icon>
                  <i-material-symbols:restore-from-trash-outline-rounded />
                </template>
              </icon-button>
            </template>
            <template v-else>
              <icon-button class="sm" @click.stop.prevent="trash(`ids:${item.id}`)" v-tooltip="$t('move_to_trash')" :loading="trashLoading(`ids:${item.id}`)">
                <template #icon>
                  <i-material-symbols:delete-outline-rounded />
                </template>
              </icon-button>
              <icon-button class="sm" @click.stop.prevent="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <template #icon>
                  <i-material-symbols:label-outline-rounded />
                </template>
              </icon-button>
            </template>
          </div>
          <div class="time">
            <span v-tooltip="formatDateTime(item.updatedAt)">
              {{ formatTimeAgo(item.updatedAt) }}
            </span>
          </div>
        </article>
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
import { onActivated, onDeactivated, reactive, ref } from 'vue'
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
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
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

function getUrl(q: string) {
  return q ? `/notes?q=${q}` : `/notes`
}

const { mutate: exportNotes, onDone: onExpored } = initMutation({
  document: exportNotesGQL,
  appApi: true,
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
    appApi: true,
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

.note-item {
  margin: 0 16px 8px 16px;
  display: grid;
  border-radius: 8px;
  grid-template-areas:
    'start title actions time'
    'start subtitle actions time';
  grid-template-columns: 48px 2fr 100px minmax(100px, 1fr);
  &:hover {
    cursor: pointer;
  }
  .number {
    font-size: 0.75rem;
    display: flex;
    justify-content: center;
  }
  .title {
    grid-area: title;
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
  }
  .actions {
    grid-area: actions;
    display: flex;
    flex-direction: row;
    gap: 4px;
    align-items: center;
    visibility: visible;
    padding-inline: 16px;
  }
  .time {
    grid-area: time;
    display: flex;
    align-items: center;
    padding-inline: 16px;
    justify-content: end;
  }
}
.select-mode {
  .note-item {
    .actions {
      visibility: hidden;
    }
  }
}

.scroller {
  .note-item {
    .skeleton-image {
      width: 50px;
      height: 50px;
    }
    .skeleton-title {
      width: 50%;
      height: 24px;
    }
    .skeleton-subtitle {
      width: 40%;
      height: 20px;
    }
    .skeleton-actions {
      width: 140px;
      height: 20px;
    }
    .skeleton-time {
      width: 60px;
      height: 20px;
    }
  }
}
</style>
