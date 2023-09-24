<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.calls')} (${total})`" />
    <template v-if="checked">
      <button class="icon-button" @click.stop="deleteItems(realAllChecked, finalQ)" v-tooltip="$t('delete')">
        <md-ripple />
        <i-material-symbols:delete-forever-outline-rounded />
      </button>
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
          <th>{{ $t('name') }}</th>
          <th>{{ $t('phone_number') }}</th>
          <th></th>
          <th>{{ $t('phone_geo') }}</th>
          <th>{{ $t('duration') }}</th>
          <th>{{ $t('type') }}</th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('started_at') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" :class="{ selected: item.checked }" @click.stop="toggleRow(item)">
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td><field-id :id="item.id" :raw="item" /></td>
          <td>
            {{ item.name }}
          </td>
          <td>
            <div class="v-center">
              {{ item.number }}
            </div>
          </td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="icon-button" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <md-circular-progress indeterminate class="spinner-sm" v-if="callLoading && callId === item.id" />
              <button class="icon-button" v-else @click.stop="call(item)" v-tooltip="$t('make_a_phone_call')">
                <md-ripple />
                <i-material-symbols:call-outline-rounded />
              </button>
              <button class="icon-button" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
            </div>
          </td>
          <td>
            {{ getGeoText(item.geo) }}
          </td>
          <td class="nowrap">
            {{ formatSeconds(item.duration) }}
          </td>
          <td class="nowrap">{{ $t('call_type.' + item.type) }}</td>
          <td>
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            <span v-tooltip="formatDateTimeFull(item.startedAt)">
              {{ formatDateTime(item.startedAt) }}
            </span>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td colspan="10">
            <div class="no-data-placeholder">
              {{ $t(noDataKey(loading, app.permissions, 'READ_CALL_LOG')) }}
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
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
import { buildQuery, type IFilterField } from '@/lib/search'
import type { IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, ITag } from '@/lib/interfaces'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { kebabCase } from 'lodash'
import { useDelete, useSelectable } from './hooks/list'
import { useAddToTags, useTags } from './hooks/tags'
import emitter from '@/plugins/eventbus'
import { callGQL, deleteCallsGQL, initMutation } from '@/lib/api/mutation'
import { remove } from 'lodash-es'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<any[]>([])
const searchInputRef = ref()
const { t } = useI18n()
const filter: IFilter = reactive({
  text: '',
  tags: [],
})

const dataType = DataType.CALL
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
const { deleteItems } = useDelete(
  deleteCallsGQL,
  () => {
    refetch()
    if (items.value.some((it) => it.tags.length)) {
      emitter.emit('refetch_tags', dataType)
    }
  },
  items
)

const {
  allChecked,
  realAllChecked,
  selectRealAll,
  allCheckedAlertVisible,
  clearSelection,
  toggleAllChecked,
  toggleItemChecked,
  toggleRow,
  total,
  checked,
} = useSelectable(items)
const { loading, load, refetch } = initLazyQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.calls.map((it: any) => ({ ...it, checked: false }))
        total.value = data.callCount
      }
    }
  },
  document: callsGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

const currentType = route.params['type'] as string
const types: Record<string, number> = {
  incoming: 1,
  outgoing: 2,
  missed: 3,
}

watch(page, (value: number) => {
  if (currentType) {
    replacePath(mainStore, `/calls/${currentType}?page=${value}&q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/calls?page=${value}&q=${encodeBase64(q.value)}`)
  }
})

function addItemToTags(item: any) {
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

function onTagSelect(item: ITag) {
  if (filter.tags.includes(item)) {
    remove(filter.tags, (it: ITag) => it.id === item.id)
  } else {
    filter.tags.push(item)
  }
}

function applyAndDoSearch() {
  const fileds: IFilterField[] = []
  for (const tag of filter.tags) {
    fileds.push({
      name: 'tag',
      op: '',
      value: kebabCase(tag.name),
    })
  }

  if (filter.text) {
    fileds.push({
      name: 'text',
      op: '',
      value: filter.text,
    })
  }

  q.value = buildQuery(fileds)
  doSearch()
  searchInputRef.value.dismiss()
}

function doSearch() {
  if (currentType) {
    replacePath(mainStore, `/calls/${currentType}?q=${encodeBase64(q.value)}`)
  } else {
    replacePath(mainStore, `/calls?q=${encodeBase64(q.value)}`)
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

onMounted(() => {
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
})

onUnmounted(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
})

function getGeoText(geo: any) {
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

function call(item: any) {
  callId.value = item.id
  mutateCall({ number: item.number })
}

function deleteItem(item: any) {
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
</script>
