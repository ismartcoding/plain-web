<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.calls') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItems(selectedIds, realAllChecked, total, q)">
          <i-material-symbols:delete-forever-outline-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addToTags(selectedIds, realAllChecked, q)">
          <i-material-symbols:label-outline-rounded />
        </v-icon-button>
      </template>
    </div>

    <div class="actions">
      <search-input :filter="filter" :tags="tags" :types="types" :get-url="getUrl" :show-chips="!isPhone" :is-phone="isPhone" />
    </div>
    <SearchFilters v-if="isPhone" class="mobile-search-filters" :filter="filter" :tags="tags" :feeds="[]" :buckets="[]" :types="[]" @filter-change="onFilterChange" />
  </div>
  <all-checked-alert
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="selectRealAll"
    :clear-selection="clearSelection"
  />
  <div class="scroll-content">
    <div class="main-list" :class="{ 'select-mode': checked }">
      <CallListItem
        v-for="(item, i) in items"
        :key="item.id"
        :item="item"
        :index="i"
        :selected-ids="selectedIds"
        :shift-effecting-ids="shiftEffectingIds"
        :should-select="shouldSelect"
        :is-phone="isPhone"
        :data-type="dataType"
        :call-loading="callLoading"
        :call-id="callId"
        :handle-item-click="handleItemClick"
        :handle-mouse-over="handleMouseOver"
        :toggle-select="toggleSelect"
        @delete-item="deleteItem"
        @call="call"
        @add-item-to-tags="addItemToTags"
      />
      <template v-if="loading && items.length === 0">
        <CallSkeletonItem v-for="i in 20" :key="i" :index="i" :is-phone="isPhone" />
      </template>
    </div>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_CALL_LOG')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
  </div>
</template>

<script setup lang="ts">
import { inject, onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'

import { callsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import type { ICall, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, ITag } from '@/lib/interfaces'
import { decodeBase64 } from '@/lib/strutil'
import { useDelete, useSelectable } from '@/hooks/list'
import { useSearch } from '@/hooks/search'
import { useAddToTags, useTags } from '@/hooks/tags'
import emitter from '@/plugins/eventbus'
import { callGQL, deleteCallsGQL, initMutation } from '@/lib/api/mutation'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { useKeyEvents } from '@/hooks/key-events'
import CallListItem from '@/components/calls/CallListItem.vue'

const isPhone = inject('isPhone') as boolean
const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<ICall[]>([])
const { t } = useI18n()
const { parseQ, buildQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})

const dataType = DataType.CALL
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref('')
const { tags, fetch: fetchTags } = useTags(dataType)
const { addToTags } = useAddToTags(dataType, tags)
const { deleteItems } = useDelete(deleteCallsGQL, () => {
  clearSelection()
  fetch()
  emitter.emit('refetch_tags', dataType)
  emitter.emit('calls_deleted')
})

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
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/calls?page=${page}&q=${q}` : `/calls?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  deleteItems(selectedIds.value, realAllChecked.value, total.value, q.value)
})
const { loading, fetch } = initLazyQuery({
  handle: (data: { calls: ICall[]; callCount: number }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.calls
        total.value = data.callCount
      }
    }
  },
  document: callsGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
  }),
})

const types = ['1', '2', '3'].map((it) => ({ id: it, name: t('call_type.' + it) }))

function addItemToTags(item: ICall) {
  openModal(UpdateTagRelationsModal, {
    type: dataType,
    tags: tags.value,
    item: {
      key: item.id,
      title: '',
      size: 0,
    },
    selected: tags.value.filter((it) => item.tags.some((t: ITag) => t.id === it.id)),
  })
}

function getUrl(q: string) {
  return q ? `/calls?q=${q}` : `/calls`
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



const callId = ref('')
const { mutate: mutateCall, loading: callLoading } = initMutation({
  document: callGQL,
})

function call(item: ICall) {
  callId.value = item.id
  mutateCall({ number: item.number })
}

function deleteItem(item: ICall) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.number,
    gql: gql`
      mutation DeleteCall($query: String!) {
        deleteCalls(query: $query)
      }
    `,
    variables: () => ({
      query: `ids:${item.id}`,
    }),
    typeName: 'Call',
    done: () => {
      total.value--
      if (item.tags.length) {
        emitter.emit('refetch_tags', dataType)
      }
      emitter.emit('calls_deleted')
    },
  })
}

function onFilterChange(newFilter: IFilter) {
  Object.assign(filter, newFilter)
  replacePath(mainStore, getUrl(buildQ(filter)))
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
</script>
<style scoped lang="scss">
:deep(.call-item) {
  grid-template-areas:
    'start title actions geo time'
    'start subtitle actions geo time';
  grid-template-columns: 48px 2fr 1fr minmax(64px, 1fr) minmax(64px, 1fr);
  .title {
    margin-inline-end: 16px;
    padding-block: 8px;
  }
  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.875rem;
    margin-inline-end: 16px;
  }

  .geo {
    grid-area: geo;
    display: flex;
    align-items: center;
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
