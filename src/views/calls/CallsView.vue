<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('page_title.calls') }} ({{ total.toLocaleString() }})</div>
    <div class="actions">
      <search-input :filter="filter" :tags="tags" :types="types" :get-url="getUrl" />
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
          <th>{{ $t('name') }}</th>
          <th>{{ $t('phone_number') }}</th>
          <th>{{ $t('phone_geo') }}</th>
          <th>{{ $t('duration') }}</th>
          <th></th>
          <th>{{ $t('type') }}</th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('started_at') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, i) in items" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click.stop="toggleRow($event, item, i)">
          <td><md-checkbox touch-target="wrapper" @change="toggleRow($event, item, i)" :checked="selectedIds.includes(item.id)" /></td>
          <td v-if="app.developerMode"><field-id :id="item.id" :raw="item" /></td>
          <td>
            {{ item.name }}
          </td>
          <td>
            <div class="v-center">
              {{ item.number }}
            </div>
          </td>
          <td>
            {{ getGeoText(item.geo) }}
          </td>
          <td class="nowrap">
            {{ formatSeconds(item.duration) }}
          </td>
          <td class="nowrap">
            <div class="action-btns">
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
          </td>
          <td class="nowrap">{{ $t('call_type.' + item.type) }}</td>
          <td>
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            <time v-tooltip="formatDateTimeFull(item.startedAt)">
              {{ formatDateTime(item.startedAt) }}
            </time>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td :colspan="app.developerMode ? 10 : 9">
            <div class="no-data-placeholder">
              {{ $t(noDataKey(loading, app.permissions, 'WRITE_CALL_LOG')) }}
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
import { formatDateTime, formatDateTimeFull, formatSeconds } from '@/lib/format'
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
})

const { selectedIds, allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleRow, total, checked, selectAll } = useSelectable(items)
const gotoPage = (page: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/calls?page=${page}&q=${q}` : `/calls?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  deleteItems(realAllChecked.value, selectedIds.value, q.value)
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
    name: item.id,
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
