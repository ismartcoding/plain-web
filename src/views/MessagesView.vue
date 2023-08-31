<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.messages')} (${total})`" />
    <template v-if="checked">
      <button class="icon-button" @click.stop="addToTags(realAllChecked, finalQ)" v-tooltip="$t('add_to_tags')">
        <md-ripple />
        <i-material-symbols:label-outline-rounded />
      </button>
    </template>
    <search-input ref="searchInputRef" v-model="q" :search="doSearch">
      <template #filters>
        <div class="filters">
          <md-outlined-text-field :label="$t('keywords')" v-model="filter.text" keyup.enter="applyAndDoSearch" />
          <label class="form-label">{{ $t('tags') }}</label>
          <md-chip-set type="filter">
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
          <th>{{ $t('content') }}</th>
          <th></th>
          <th>{{ $t('sms_address') }}</th>
          <th>{{ $t('type') }}</th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('time') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          :class="{ selected: item.checked }"
          @click.stop="item.checked = !item.checked"
        >
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td>
            <field-id :id="item.id" :raw="item" />
          </td>
          <td v-html="addLinksToURLs(item.body)"></td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="icon-button" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
            </div>
          </td>
          <td>{{ item.address }}</td>
          <td class="nowrap">{{ $t(`message_type.${item.type}`) }}</td>
          <td>
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            <span v-tooltip="formatDateTimeFull(item.date)">
              {{ formatDateTime(item.date) }}
            </span>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td colspan="8">
            <div class="no-data-placeholder">
              {{ $t(noDataKey(loading, app.permissions, 'READ_SMS')) }}
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { nextTick, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { initLazyQuery, messagesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { useI18n } from 'vue-i18n'
import { noDataKey } from '@/lib/list'
import { storeToRefs } from 'pinia'
import type {
  IFilter,
  IItemTagsUpdatedEvent,
  IItemsTagsUpdatedEvent,
  IMessage,
  IMessageItem,
  ITag,
} from '@/lib/interfaces'
import { useAddToTags, useTags } from './hooks/tags'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { useSelectable } from './hooks/list'
import emitter from '@/plugins/eventbus'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import { remove } from 'lodash-es'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { addLinksToURLs } from '@/lib/strutil'
import { DataType } from '@/lib/data'

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<IMessageItem[]>([])
const searchInputRef = ref()
const { t } = useI18n()
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const dataType = DataType.SMS
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(dataType, q, filter, async (fields: IFilterField[]) => {
  if (currentType) {
    fields.push({
      name: 'type',
      op: '',
      value: types[currentType].toString(),
    })
  }

  finalQ.value = buildQuery(fields)
  await nextTick()
  load()
})
const { addToTags } = useAddToTags(dataType, items, tags)

const {
  allChecked,
  realAllChecked,
  selectRealAll,
  allCheckedAlertVisible,
  clearSelection,
  toggleAllChecked,
  toggleItemChecked,
  total,
  checked,
} = useSelectable(items)
const { loading, load, refetch } = initLazyQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.messages.map((it: IMessage) => ({ ...it, checked: false }))
        total.value = data.messageCount
      }
    }
  },
  document: messagesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

const currentType = route.params['type'] as string
const types: Record<string, number> = {
  inbox: 1,
  sent: 2,
  drafts: 3,
  outbox: 4,
}

watch(page, (value: number) => {
  if (currentType) {
    replacePath(mainStore, `/messages/${currentType}?page=${value}&q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/messages?page=${value}&q=${encodeBase64(q.value)}`)
  }
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

function addItemToTags(item: IMessageItem) {
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

function doSearch() {
  if (currentType) {
    replacePath(mainStore, `/messages/${currentType}?q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/messages?q=${encodeBase64(q.value)}`)
  }
}

const itemsTagsUpdatedHandler = (event: IItemsTagsUpdatedEvent) => {
  if (event.type === dataType) {
    clearSelection()
    refetch()
  }
}

const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
  if (event.type === dataType) {
    refetch()
  }
}

onActivated(() => {
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
})
</script>
