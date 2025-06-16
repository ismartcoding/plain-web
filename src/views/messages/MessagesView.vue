<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.messages') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <button v-tooltip="$t('add_to_tags')" class="btn-icon" @click.stop="addToTags(selectedIds, realAllChecked, q)">
          <i-material-symbols:label-outline-rounded />
        </button>
      </template>
    </div>

    <div class="actions">
      <search-input :filter="filter" :tags="tags" :types="types" :get-url="getUrl" :show-chips="!isPhone" :is-phone="isPhone" />
    </div>
  </div>
  <SearchFilters v-if="isPhone" class="mobile-search-filters" :filter="filter" :tags="tags" :feeds="[]" :buckets="[]" :types="[]" @filter-change="onFilterChange" />
  <all-checked-alert
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="selectRealAll"
    :clear-selection="clearSelection"
  />
  <div class="scroll-content">
    <div class="sms-list" :class="{ 'select-mode': checked }">
      <section
        v-for="(item, i) in items"
        :key="item.id"
        class="sms-item selectable-card"
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
          {{ item.address }}
        </div>
        <div class="subtitle" v-html="addLinksToURLs(item.body)"></div>
        <div class="actions">
          <button v-tooltip="$t('add_to_tags')" class="btn-icon sm" @click.stop="addItemToTags(item)">
            
            <i-material-symbols:label-outline-rounded />
          </button>
          <v-circular-progress v-if="callLoading && callId === item.id" indeterminate class="sm" />
          <button v-else v-tooltip="$t('make_a_phone_call')" class="btn-icon sm" @click.stop="call(item)">
            <i-material-symbols:call-outline-rounded />
          </button>
        </div>
        <div class="info">
          <span>{{ $t(`message_type.${item.type}`) }}</span>
          <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
        </div>
        <div class="time">
          <span v-tooltip="formatDateTime(item.date)">
            {{ formatTimeAgo(item.date) }}
          </span>
        </div>
      </section>
      <template v-if="loading && items.length === 0">
        <MessageSkeletonItem v-for="i in 20" :key="i" :index="i" :is-phone="isPhone" />
      </template>
    </div>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'READ_SMS')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
  </div>
</template>

<script setup lang="ts">
import { inject, onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import { initLazyQuery, messagesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import { storeToRefs } from 'pinia'
import type { IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMessage } from '@/lib/interfaces'
import { useAddToTags, useTags } from '@/hooks/tags'
import { decodeBase64 } from '@/lib/strutil'
import { useSelectable } from '@/hooks/list'
import { useSearch } from '@/hooks/search'
import emitter from '@/plugins/eventbus'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { addLinksToURLs } from '@/lib/strutil'
import { DataType } from '@/lib/data'
import { callGQL, initMutation } from '@/lib/api/mutation'
import { useKeyEvents } from '@/hooks/key-events'

const isPhone = inject('isPhone')
const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<IMessage[]>([])
const { t } = useI18n()
const { parseQ, buildQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})

const dataType = DataType.SMS
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref('')
const { tags, fetch: fetchTags } = useTags(dataType)
const { addToTags } = useAddToTags(dataType, tags)
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
  replacePath(mainStore, q ? `/messages?page=${page}&q=${q}` : `/messages?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {})
const { loading, fetch } = initLazyQuery({
  handle: (data: { messages: IMessage[]; messageCount: number }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.messages
        total.value = data.messageCount
      }
    }
  },
  document: messagesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
  }),
})

const types = ['1', '2', '3'].map((it) => ({ id: it, name: t('message_type.' + it) }))

function addItemToTags(item: IMessage) {
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

const callId = ref('')
const { mutate: mutateCall, loading: callLoading } = initMutation({
  document: callGQL,
})

function call(item: IMessage) {
  callId.value = item.id
  mutateCall({ number: item.address })
}

function getUrl(q: string) {
  return q ? `/messages?q=${q}` : `/messages`
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
:deep(.sms-item) {
  display: grid;
  border-radius: 8px;
  padding-block-end: 12px;
  grid-template-areas:
    'start title actions info time'
    'start subtitle actions info time';
  grid-template-columns: 48px 3fr 100px minmax(64px, 1fr) minmax(64px, 1fr);
  .number {
    font-size: 0.75rem;
    display: flex;
    justify-content: center;
  }
  .title {
    grid-area: title;
    font-weight: 500;
    margin-inline-end: 16px;
    padding-block-start: 12px;
    padding-block-end: 8px;
  }
  .subtitle {
    grid-area: subtitle;
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
  .info {
    grid-area: info;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
    justify-content: center;
    gap: 8px;
    font-size: 0.875rem;
  }
  .time {
    grid-area: time;
    display: flex;
    align-items: center;
    padding-inline: 16px;
    justify-content: end;
  }
}
.sms-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sms-list.select-mode {
  .sms-item {
    cursor: pointer;
    .actions {
      visibility: hidden;
    }
  }
}
</style>
