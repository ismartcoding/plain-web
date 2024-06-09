<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('page_title.aichats') }} ({{ total.toLocaleString() }})</div>
    <div class="actions">
      <search-input :filter="filter" :tags="tags" :get-url="getUrl" />
      <template v-if="checked">
        <button class="btn-icon" @click.stop="deleteItems(realAllChecked, selectedIds, q)" v-tooltip="$t('delete')">
          <md-ripple />
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
        <button class="btn-icon" @click.stop="addToTags(selectedIds, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
          <md-ripple />
          <i-material-symbols:label-outline-rounded />
        </button>
      </template>
      <md-outlined-button class="btn-sm" @click.prevent="create">{{ $t('new_chat') }}</md-outlined-button>
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
  <div class="table-responsive">
    <table class="table">
      <thead>
        <tr>
          <th>
            <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
          </th>
          <th v-if="app.developerMode">ID</th>
          <th>{{ $t('content') }}</th>
          <th></th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('updated_at') }}</th>
          <th>{{ $t('created_at') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, i) in items" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click.stop="toggleRow($event, item, i)">
          <td><md-checkbox touch-target="wrapper" @change="toggleRow($event, item, i)" :checked="selectedIds.includes(item.id)" /></td>
          <td v-if="app.developerMode"><field-id :id="item.id" :raw="item" /></td>
          <td>
            <a href="#" @click.prevent="view(item)">{{ truncate(item.content, { length: 200, omission: '' }) }}</a>
          </td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="btn-icon sm" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button class="btn-icon sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
            </div>
          </td>
          <td>
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            <time v-tooltip="formatDateTimeFull(item.updatedAt)">
              {{ formatDateTime(item.updatedAt) }}
            </time>
          </td>
          <td class="nowrap">
            <time v-tooltip="formatDateTimeFull(item.createdAt)">
              {{ formatDateTime(item.updatedAt) }}
            </time>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td :colspan="app.developerMode ? 7 : 6">
            <div class="no-data-placeholder">
              {{ $t(noDataKey(loading)) }}
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
  <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { aichatsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { pushPath, replacePath } from '@/plugins/router'
import { useI18n } from 'vue-i18n'
import type { IAIChat, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent } from '@/lib/interfaces'
import { decodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useDelete, useSelectable } from '@/hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags, useTags } from '@/hooks/tags'
import { deleteAIChatsGQL } from '@/lib/api/mutation'
import { truncate } from 'lodash-es'
import { openModal } from '@/components/modal'
import gql from 'graphql-tag'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import { DataType } from '@/lib/data'
import { useSearch } from '@/hooks/search'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { useMainStore } from '@/stores/main'
import { useKeyEvents } from '@/hooks/key-events'

const items = ref<IAIChat[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const mainStore = useMainStore()
const tempStore = useTempStore()
const { app } = storeToRefs(tempStore)
const dataType = DataType.AI_CHAT
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref('')
const { tags, fetch: fetchTags } = useTags(dataType)
const { addToTags } = useAddToTags(dataType, tags)
const { deleteItems } = useDelete(deleteAIChatsGQL, () => {
  fetch()
})
const { selectedIds, allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleRow, total, checked, selectAll } = useSelectable(items)

const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/aichats?page=${page}&q=${q}` : `/aichats?page=${page}`)
}

const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  deleteItems(realAllChecked.value, selectedIds.value, q.value)
})

const { loading, fetch } = initLazyQuery({
  handle: (data: { aiChats: IAIChat[]; aiChatCount: number }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.aiChats
        total.value = data.aiChatCount
      }
    }
  },
  document: aichatsGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
  }),
  appApi: true,
})

function getUrl(q: string) {
  return q ? `/aichats?q=${q}` : `/aichats`
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

function view(item: IAIChat) {
  pushPath(`/aichats/${item.id}`)
}

function create() {
  pushPath(`/aichats/create`)
}

function deleteItem(item: any) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.id,
    gql: gql`
      mutation DeleteAIChat($query: String!) {
        deleteAIChats(query: $query)
      }
    `,
    variables: () => ({
      query: `ids:${item.id}`,
    }),
    appApi: true,
    typeName: 'AIChat',
    done: () => {
      total.value--
      if (item.tags.length) {
        emitter.emit('refetch_tags', dataType)
      }
    },
  })
}

function addItemToTags(item: IAIChat) {
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
</script>
