<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.calls') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <button v-tooltip="$t('delete')" class="btn-icon" @click.stop="deleteItems(selectedIds, realAllChecked, total, q)">
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
        <button v-tooltip="$t('add_to_tags')" class="btn-icon" @click.stop="addToTags(selectedIds, realAllChecked, q)">
          <i-material-symbols:label-outline-rounded />
        </button>
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
    <div class="call-list" :class="{ 'select-mode': checked }">
      <section
        v-for="(item, i) in items"
        :key="item.id"
        class="call-item selectable-card"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleItemClick($event, item, i, () => {})"
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="list-item-start">
          <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, i)" />
          <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, i)" />
          <span class="number"><field-id :id="i + 1" :raw="item" /></span>
        </div>

        <div class="title">
          {{ item.name ? item.name + ' ' + item.number : item.number }}
        </div>
        <div class="subtitle">
          <span>{{ formatSeconds(item.duration) }}</span>
          <span>{{ $t('call_type.' + item.type) }}</span>
          <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
        </div>
        <div class="actions">
          <button v-tooltip="$t('delete')" class="btn-icon sm" @click.stop="deleteItem(item)">
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
          <v-circular-progress v-if="callLoading && callId === item.id" indeterminate class="sm" />
          <button v-else v-tooltip="$t('make_a_phone_call')" class="btn-icon sm" @click.stop="call(item)">
            <i-material-symbols:call-outline-rounded />
          </button>
          <button v-tooltip="$t('add_to_tags')" class="btn-icon sm" @click.stop="addItemToTags(item)">
            <i-material-symbols:label-outline-rounded />
          </button>
        </div>
        <div class="geo">
          {{ getGeoText(item.geo) }}
        </div>
        <div class="time">
          <span v-tooltip="formatDateTime(item.startedAt)">
            {{ formatTimeAgo(item.startedAt) }}
          </span>
        </div>
      </section>
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
import { formatDateTime, formatSeconds, formatTimeAgo } from '@/lib/format'
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
import type { ICall, ICallGeo, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, ITag } from '@/lib/interfaces'
import { decodeBase64 } from '@/lib/strutil'
import { useDelete, useSelectable } from '@/hooks/list'
import { useSearch } from '@/hooks/search'
import { useAddToTags, useTags } from '@/hooks/tags'
import emitter from '@/plugins/eventbus'
import { callGQL, deleteCallsGQL, initMutation } from '@/lib/api/mutation'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { useKeyEvents } from '@/hooks/key-events'

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

function getGeoText(geo: ICallGeo | null | undefined) {
  if (!geo) {
    return ''
  }

  const texts = []
  if (geo.isp) {
    texts.push(t('phone_isp_type.' + geo.isp))
  }

  if (geo.city === geo.province) {
    texts.push(geo.city)
  } else {
    texts.push(`${geo.province}${geo.city}`)
  }

  return texts.join(', ')
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
  display: grid;
  border-radius: 8px;
  grid-template-areas:
    'start title actions geo time'
    'start subtitle actions geo time';
  grid-template-columns: 48px 2fr 1fr minmax(64px, 1fr) minmax(64px, 1fr);
  .number {
    font-size: 0.75rem;
    display: flex;
    justify-content: center;
    padding-block-end: 12px;
  }
  .title {
    grid-area: title;
    font-weight: 500;
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
.call-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  &.select-mode {
    .call-item {
      cursor: pointer;
      .actions {
        visibility: hidden;
      }
    }
  }
}
</style>
