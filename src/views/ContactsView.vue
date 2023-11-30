<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.contacts')} (${total})`" />
    <template v-if="checked">
      <button class="icon-button" @click.stop="deleteItems(realAllChecked, finalQ)" v-tooltip="$t('delete')">
        <md-ripple />
        <i-material-symbols:delete-forever-outline-rounded />
      </button>
      <button class="icon-button" v-tooltip="$t('download')" style="display: none">
        <md-ripple />
        <i-material-symbols:download-rounded />
      </button>
      <button class="icon-button" @click.stop="addToTags(realAllChecked, finalQ)" v-tooltip="$t('add_to_tags')">
        <md-ripple />
        <i-material-symbols:label-outline-rounded />
      </button>
    </template>
    <md-outlined-button @click="create" style="margin-inline-start: 16px">
      {{ $t('create') }}
    </md-outlined-button>
    <search-input ref="searchInputRef" v-model="q" :search="doSearch">
      <template #filters>
        <div class="filters">
          <md-outlined-text-field :label="$t('keywords')" v-model="filter.text" keyup.enter="applyAndDoSearch" />
          <label class="form-label">{{ $t('tags') }}</label>
          <md-chip-set>
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
          <th>{{ $t('avatar') }}</th>
          <th>{{ $t('name') }}</th>
          <th></th>
          <th></th>
          <th>{{ $t('notes') }}</th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('updated_at') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id" :class="{ selected: item.checked }" @click.stop="toggleRow(item)">
          <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
          <td><field-id :id="item.id" :raw="item" /></td>
          <td><img v-if="item.thumbnailId" :src="getFileUrl(item.thumbnailId)" width="50" /></td>
          <td class="nowrap">
            {{ fullName(item) }}
          </td>
          <td class="nowrap">
            <ul class="list-unstyled">
              <li class="v-center" v-for="(it, index) in item.phoneNumbers" :key="index">
                {{ it.type > 0 ? $t(`contact.phone_number_type.${it.type}`) : it.label }}
                {{ it.normalizedNumber || it.value }}
                <md-circular-progress
                  indeterminate
                  class="spinner-sm"
                  v-if="callLoading && callId === item.id && callIndex === index"
                />
                <button
                  class="icon-button"
                  v-else
                  @click.stop="call(item.id, it.normalizedNumber || it.value, index)"
                  v-tooltip="$t('make_a_phone_call')"
                >
                  <md-ripple />
                  <i-material-symbols:call-outline-rounded />
                </button>
              </li>
              <li v-for="it in item.emails">
                {{ it.type > 0 ? $t(`contact.email_type.${it.type}`) : it.label }} {{ it.value }}
              </li>
              <li v-for="it in item.addresses">
                {{ it.type > 0 ? $t(`contact.address_type.${it.type}`) : it.label }} {{ it.value }}
              </li>
              <li v-for="it in item.websites">
                {{ it.type > 0 ? $t(`contact.website_type.${it.type}`) : it.label }} {{ it.value }}
              </li>
              <li v-for="it in item.ims">
                {{ it.type > 0 ? $t(`contact.im_type.${it.type}`) : it.label }} {{ it.value }}
              </li>
              <li v-for="it in item.events">
                {{ it.type > 0 ? $t(`contact.event_type.${it.type}`) : it.label }} {{ it.value }}
              </li>
            </ul>
          </td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="icon-button" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button class="icon-button" @click.stop="edit(item)" v-tooltip="$t('edit')">
                <md-ripple />
                <i-material-symbols:edit />
              </button>
              <button class="icon-button" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
            </div>
          </td>
          <td>{{ item.notes }}</td>
          <td>
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            <span v-tooltip="formatDateTimeFull(item.updatedAt)">
              {{ formatDateTime(item.updatedAt) }}
            </span>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td colspan="9">
            <div class="no-data-placeholder">
              {{ $t(noDataKey(loading, app.permissions, 'READ_CONTACTS')) }}
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
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { initQuery, contactsGQL, contactSourcesGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { containsChinese, decodeBase64, encodeBase64 } from '@/lib/strutil'
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { getFileUrl } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import EditContactModal from '@/components/EditContactModal.vue'
import type { IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, ITag } from '@/lib/interfaces'
import { useAddToTags, useTags } from './hooks/tags'
import { useDelete, useSelectable } from './hooks/list'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import emitter from '@/plugins/eventbus'
import { callGQL, deleteContactsGQL, initMutation } from '@/lib/api/mutation'
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
const dataType = DataType.CONTACT

const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const sources = ref([])
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(dataType, q, filter, async (fields: IFilterField[]) => {
  finalQ.value = buildQuery(fields)
  await nextTick()
  load()
})
const { addToTags } = useAddToTags(dataType, items, tags)
const { deleteItems } = useDelete(
  deleteContactsGQL,
  () => {
    clearSelection()
    refetch()
    emitter.emit('refetch_tags', dataType)
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
        items.value = data.contacts.map((it: any) => ({ ...it, checked: false }))
        total.value = data.contactCount
      }
    }
  },
  document: contactsGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        sources.value = data.contactSources
      }
    }
  },
  document: contactSourcesGQL,
  variables: null,
  appApi: true,
})

watch(page, (value: number) => {
  replacePath(mainStore, `/contacts?page=${value}&q=${encodeBase64(q.value)}`)
})

function applyAndDoSearch() {
  q.value = buildFilterQuery(filter)
  doSearch()
  searchInputRef.value.dismiss()
}

function doSearch() {
  replacePath(mainStore, `/contacts?q=${encodeBase64(q.value)}`)
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

function fullName(item: any) {
  let name = ''
  if (containsChinese(item.firstName) || containsChinese(item.lastName)) {
    name = `${item.lastName}${item.middleName}${item.firstName}`
  } else {
    name = [item.firstName, item.middleName, item.lastName].filter((it) => it).join(' ')
  }

  const suffixComma = item.suffix ? `, ${item.suffix}` : ''
  const fullName = `${item.prefix} ${name} ${suffixComma}`.trim()
  if (fullName) {
    return fullName
  }

  if (item.emails.length) {
    return item.emails[0].value
  }

  return ''
}

function onTagSelect(item: ITag) {
  if (filter.tags.includes(item)) {
    remove(filter.tags, (it: ITag) => it.id === item.id)
  } else {
    filter.tags.push(item)
  }
}

function deleteItem(item: any) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: fullName(item),
    gql: gql`
      mutation DeleteContact($query: String!) {
        deleteContacts(query: $query)
      }
    `,
    variables: () => ({
      query: `ids:${item.id}`,
    }),
    appApi: true,
    typeName: 'Contact',
    done: () => {
      total.value--
      if (item.tags.length) {
        emitter.emit('refetch_tags', dataType)
      }
    },
  })
}

function edit(item: any) {
  openModal(EditContactModal, {
    data: item,
    sources: sources,
    done: refetch,
  })
}

function create() {
  openModal(EditContactModal, {
    data: null,
    sources: sources,
    done: refetch,
  })
}

const callId = ref('')
const callIndex = ref(0)
const { mutate: mutateCall, loading: callLoading } = initMutation({
  document: callGQL,
  appApi: true,
})

function call(id: string, number: string, index: number) {
  callId.value = id
  callIndex.value = index
  mutateCall({ number })
}
</script>
<style lang="scss" scoped>
.list-unstyled {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
