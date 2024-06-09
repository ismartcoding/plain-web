<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('page_title.contacts') }} ({{ total.toLocaleString() }})</div>
    <div class="actions">
      <search-input :filter="filter" :tags="tags" :get-url="getUrl" />
      <template v-if="checked">
        <button class="btn-icon" @click.stop="deleteItems(realAllChecked, selectedIds, q)" v-tooltip="$t('delete')">
          <md-ripple />
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
        <button class="btn-icon" v-tooltip="$t('download')" style="display: none">
          <md-ripple />
          <i-material-symbols:download-rounded />
        </button>
        <button class="btn-icon" @click.stop="addToTags(selectedIds, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
          <md-ripple />
          <i-material-symbols:label-outline-rounded />
        </button>
      </template>
      <md-outlined-button class="btn-sm" @click="create">
        {{ $t('create') }}
      </md-outlined-button>
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
        <tr v-for="(item, i) in items" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click.stop="toggleRow($event, item, i)">
          <td><md-checkbox touch-target="wrapper" @change="toggleRow($event, item, i)" :checked="selectedIds.includes(item.id)" /></td>
          <td v-if="app.developerMode"><field-id :id="item.id" :raw="item" /></td>
          <td><img v-if="item.thumbnailId" :src="getFileUrl(item.thumbnailId)" width="50" /></td>
          <td class="nowrap">
            {{ fullName(item) }}
          </td>
          <td class="nowrap">
            <ul class="list-unstyled">
              <li class="phone-number" v-for="(it, index) in item.phoneNumbers" :key="index">
                {{ it.type > 0 ? $t(`contact.phone_number_type.${it.type}`) : it.label }}
                {{ it.normalizedNumber || it.value }}
                <md-circular-progress indeterminate class="spinner-sm" v-if="callLoading && callId === item.id && callIndex === index" />
                <button class="btn-icon sm" v-else @click.stop="call(item.id, it.normalizedNumber || it.value, index)" v-tooltip="$t('make_a_phone_call')">
                  <md-ripple />
                  <i-material-symbols:call-outline-rounded />
                </button>
              </li>
              <li v-for="it in item.emails" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.email_type.${it.type}`) : it.label }} {{ it.value }}</li>
              <li v-for="it in item.addresses" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.address_type.${it.type}`) : it.label }} {{ it.value }}</li>
              <li v-for="it in item.websites" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.website_type.${it.type}`) : it.label }} {{ it.value }}</li>
              <li v-for="it in item.ims" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.im_type.${it.type}`) : it.label }} {{ it.value }}</li>
              <li v-for="it in item.events" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.event_type.${it.type}`) : it.label }} {{ it.value }}</li>
            </ul>
          </td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="btn-icon sm" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button class="btn-icon sm" @click.stop="edit(item)" v-tooltip="$t('edit')">
                <md-ripple />
                <i-material-symbols:edit />
              </button>
              <button class="btn-icon sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
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
            <time v-tooltip="formatDateTimeFull(item.updatedAt)">
              {{ formatDateTime(item.updatedAt) }}
            </time>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td :colspan="app.developerMode ? 9 : 8">
            <div class="no-data-placeholder">
              {{ $t(noDataKey(loading, app.permissions, 'WRITE_CONTACTS')) }}
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
import { initQuery, contactsGQL, contactSourcesGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { containsChinese, decodeBase64 } from '@/lib/strutil'
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { getFileUrl } from '@/lib/api/file'
import { noDataKey } from '@/lib/list'
import { storeToRefs } from 'pinia'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import EditContactModal from '@/components/EditContactModal.vue'
import type { IContact, IContactSource, IFilter, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, ITag } from '@/lib/interfaces'
import { useAddToTags, useTags } from '@/hooks/tags'
import { useDelete, useSelectable } from '@/hooks/list'
import emitter from '@/plugins/eventbus'
import { callGQL, deleteContactsGQL, initMutation } from '@/lib/api/mutation'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { DataType } from '@/lib/data'
import { useSearch } from '@/hooks/search'
import { useKeyEvents } from '@/hooks/key-events'

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<IContact[]>([])
const { t } = useI18n()
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const dataType = DataType.CONTACT

const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const sources = ref<IContactSource[]>([])
const limit = 50
const q = ref('')
const { tags, fetch: fetchTags } = useTags(dataType)
const { addToTags } = useAddToTags(dataType, tags)
const { deleteItems } = useDelete(deleteContactsGQL, () => {
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
  handle: (data: { contacts: IContact[]; contactCount: number }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.contacts
        total.value = data.contactCount
      }
    }
  },
  document: contactsGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: q.value,
  }),
  appApi: true,
})

initQuery({
  handle: (data: { contactSources: IContactSource[] }, error: string) => {
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

function addItemToTags(item: IContact) {
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

function fullName(item: IContact) {
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

function deleteItem(item: IContact) {
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

function edit(item: IContact) {
  openModal(EditContactModal, {
    data: item,
    sources: sources,
    done: fetch,
  })
}

function create() {
  openModal(EditContactModal, {
    data: null,
    sources: sources,
    done: fetch,
  })
}

function getUrl(q: string) {
  return q ? `/contacts?q=${q}` : `/contacts`
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
<style lang="scss" scoped>
.list-unstyled {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
