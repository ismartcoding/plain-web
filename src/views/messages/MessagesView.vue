<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('page_title.messages') }} ({{ total.toLocaleString() }})</div>
    <div class="actions">
      <search-input :filter="filter" :tags="tags" :types="types" :get-url="getUrl" />
      <template v-if="checked">
        <button class="btn-icon" @click.stop="addToTags(items, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
          <md-ripple />
          <i-material-symbols:label-outline-rounded />
        </button>
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
          <th>{{ $t('content') }}</th>
          <th></th>
          <th>{{ $t('sms_address') }}</th>
          <th>{{ $t('type') }}</th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('time') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" :class="{ selected: item.checked }" @click.stop="toggleRow(item)">
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td v-if="app.developerMode">
            <field-id :id="item.id" :raw="item" />
          </td>
          <td v-html="addLinksToURLs(item.body)"></td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="btn-icon sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
            </div>
          </td>
          <td class="nowrap">
            <div class="phone-number">
              {{ item.address }} <md-circular-progress indeterminate class="spinner-sm" v-if="callLoading && callId === item.id" />
              <button class="btn-icon sm" v-else @click.stop="call(item)" v-tooltip="$t('make_a_phone_call')">
                <md-ripple />
                <i-material-symbols:call-outline-rounded />
              </button>
            </div>
          </td>
          <td class="nowrap">{{ $t(`message_type.${item.type}`) }}</td>
          <td>
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            <time v-tooltip="formatDateTimeFull(item.date)">
              {{ formatDateTime(item.date) }}
            </time>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td :colspan="app.developerMode ? 8 : 7">
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
import { onActivated, onDeactivated, reactive, ref, watch } from 'vue'
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
import type { IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMessage, IMessageItem } from '@/lib/interfaces'
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

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<IMessageItem[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
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
const { allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleItemChecked, toggleRow, total, checked } = useSelectable(items)
const { loading, fetch } = initLazyQuery({
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
    query: q.value,
  }),
  appApi: true,
})

const types = ['1', '2', '3'].map((it) => ({ id: it, name: t('message_type.' + it) }))

watch(page, (value: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/messages?page=${value}&q=${q}` : `/messages?page=${value}`)
})

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

const callId = ref('')
const { mutate: mutateCall, loading: callLoading } = initMutation({
  document: callGQL,
  appApi: true,
})

function call(item: any) {
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

onActivated(() => {
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
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
