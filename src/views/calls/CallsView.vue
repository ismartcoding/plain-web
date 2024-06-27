<template>
  <div class="top-app-bar">
    <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.calls') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <button class="btn-icon" @click.stop="deleteItems(selectedIds, realAllChecked, total, q)" v-tooltip="$t('delete')">
          <md-ripple />
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
        <button class="btn-icon" @click.stop="addToTags(selectedIds, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
          <md-ripple />
          <i-material-symbols:label-outline-rounded />
        </button>
      </template>
    </div>

    <div class="actions">
      <search-input :filter="filter" :tags="tags" :types="types" :get-url="getUrl" />
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
  <div class="scroll-content">
    <div class="call-list" :class="{ 'select-mode': checked }">
      <section
        class="call-item selectable-card"
        v-for="(item, i) in items"
        :key="item.id"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleItemClick($event, item, i, () => {})"
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="start">
          <md-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="shouldSelect" />
          <md-checkbox v-else class="checkbox" touch-target="wrapper" @click.stop="toggleSelect($event, item, i)" :checked="selectedIds.includes(item.id)" />
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
          <button class="btn-icon sm" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
          <md-circular-progress indeterminate class="spinner-sm" v-if="callLoading && callId === item.id" />
          <button class="btn-icon sm" v-else @click.stop="call(item)" v-tooltip="$t('make_a_phone_call')">
            <md-ripple />
            <i-material-symbols:call-outline-rounded />
          </button>
          <button class="btn-icon sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
            <md-ripple />
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
        <section class="call-item selectable-card-skeleton" v-for="i in 20" :key="i">
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
          <div class="geo">
            <div class="skeleton-text skeleton-geo"></div>
          </div>
          <div class="time">
            <div class="skeleton-text skeleton-time"></div>
          </div>
        </section>
      </template>
    </div>
    <div class="no-data-placeholder" v-if="!loading && items.length === 0">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_CALL_LOG')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, reactive, ref } from 'vue'
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

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<ICall[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
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
  appApi: true,
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
  appApi: true,
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
    appApi: true,
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
.call-item {
  display: grid;
  border-radius: 8px;
  grid-template-areas:
    'start title actions geo time'
    'start subtitle actions geo time';
  grid-template-columns: 48px 2fr 1fr minmax(64px, 1fr) minmax(64px, 1fr);
  .start {
    grid-area: start;
  }
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
}
.call-list.select-mode {
  .call-item {
    cursor: pointer;
    .actions {
      visibility: hidden;
    }
  }
}

.call-list {
  .call-item {
    .skeleton-title {
      width: 160px;
      height: 24px;
    }
    .skeleton-subtitle {
      width: 80px;
      height: 20px;
    }
    .skeleton-actions {
      width: 120px;
      height: 20px;
    }
    .skeleton-geo {
      width: 100px;
      height: 20px;
    }
    .skeleton-time {
      width: 60px;
      height: 20px;
    }
  }
}
</style>
