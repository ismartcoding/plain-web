<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.contacts')} (${total})`" />

    <div class="right-actions">
      <button type="button" class="btn btn-action" @click="create">
        {{ $t('create') }}
      </button>
      <dropdown :title="$t('actions')" :items="actionItems" />
      <search-input v-model="q" :search="doSearch">
        <template #filters>
          <div class="row mb-3">
            <label class="col-md-3 col-form-label">{{ $t('keywords') }}</label>
            <div class="col-md-9">
              <input type="text" v-model="filter.text" class="form-control" @keyup.enter="applyAndDoSearch" />
            </div>
          </div>
          <div class="row mb-3">
            <label class="col-md-3 col-form-label">{{ $t('tags') }}</label>
            <div class="col-md-9">
              <multiselect v-model="filter.tags" label="name" track-by="id" :options="tags" />
            </div>
          </div>
          <div class="actions">
            <button type="button" class="btn" @click.stop="applyAndDoSearch">
              {{ $t('search') }}
            </button>
          </div>
        </template>
      </search-input>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th><input class="form-check-input" type="checkbox" @change="toggleSelect" v-model="selectAll" /></th>
        <th>ID</th>
        <th>{{ $t('avatar') }}</th>
        <th>{{ $t('name') }}</th>
        <th>{{ $t('phone_number') }}</th>
        <th>{{ $t('content') }}</th>
        <th>{{ $t('notes') }}</th>
        <th>{{ $t('tags') }}</th>
        <th>{{ $t('updated_at') }}</th>
        <th class="actions two">{{ $t('actions') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.id" :class="{ checked: item.checked }"
        @click.stop="item.checked = !item.checked">
        <td><input class="form-check-input" type="checkbox" v-model="item.checked" /></td>
        <td><field-id :id="item.id" :raw="item" /></td>
        <td><img v-if="item.thumbnailId" :src="getFileUrl(item.thumbnailId)" /></td>
        <td>
          {{ fullName(item) }}
        </td>
        <td class="nowrap">
          <ul class="list-unstyled">
            <li v-for="(it, index) in item.phoneNumbers" :key="index">
              {{ it.type > 0 ? $t(`contact.phone_number_type.${it.type}`) : it.label }} {{ it.normalizedNumber || it.value }}
              <i class="spinner spinner-sm" v-if="callLoading && callId === item.id && callIndex === index"></i>
              <i-material-symbols:call-outline-rounded class="bi bi-btn" v-else
                @click.stop="call(item.id, it.normalizedNumber || it.value, index)" />
            </li>
          </ul>
        </td>
        <td>
          <ul class="list-unstyled">
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
        <td>{{ item.notes }}</td>
        <td>
          <span v-for="tag in item.tags" class="badge">{{ tag.name }}</span>
        </td>
        <td class="nowrap" :title="formatDateTimeFull(item.updatedAt)">
          {{ formatDateTime(item.updatedAt) }}
        </td>
        <td class="actions two">
          <a href="#" class="v-link" @click.stop="edit(item)">{{ $t('edit') }}</a>
          <a href="#" class="v-link" @click.stop="deleteItem(item)">{{ $t('delete') }}</a>
        </td>
      </tr>
    </tbody>
    <tfoot v-if="!items.length">
      <tr>
        <td colspan="10">
          <div class="no-data-placeholder">
            {{ $t(noDataKey(loading, app.permissions, 'READ_CONTACTS')) }}
          </div>
        </td>
      </tr>
    </tfoot>
  </table>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
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
import type { IDropdownItem, IFilter } from '@/lib/interfaces'
import { useAddToTags, useRemoveFromTags, useTags } from './hooks/tags'
import { useDelete, useSelectable } from './hooks/list'
import { buildFilterQuery, buildQuery, type IFilterField } from '@/lib/search'
import emitter from '@/plugins/eventbus'
import { callGQL, deleteContactsGQL, initMutation } from '@/lib/api/mutation'

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const items = ref<any[]>([])
const { t } = useI18n()
const filter: IFilter = reactive({
  text: '',
  tags: [],
})
const tagType = 'CONTACT'

const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const total = ref(0)
const sources = ref([])
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { tags } = useTags(tagType, q, filter, async (fields: IFilterField[]) => {
  finalQ.value = buildQuery(fields)
  await nextTick()
  load()
})
const { addToTags } = useAddToTags(tagType, items, tags)
const { removeFromTags } = useRemoveFromTags(tagType, items, tags)
const { deleteItems } = useDelete(
  deleteContactsGQL,
  () => {
    refetch()
  },
  items
)
const actionItems: IDropdownItem[] = [
  { text: t('add_to_tags'), click: addToTags },
  { text: t('remove_from_tags'), click: removeFromTags },
  { text: t('delete'), click: deleteItems },
]
const { selectAll, toggleSelect } = useSelectable(items)
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
}

function doSearch() {
  replacePath(mainStore, `/contacts?q=${encodeBase64(q.value)}`)
}

onMounted(() => {
  emitter.on('refetch_by_tag_type', (type: string) => {
    if (type === tagType) {
      refetch()
    }
  })
})

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

function deleteItem(item: any) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: fullName(item),
    gql: gql`
      mutation DeleteContact($id: ID!) {
        deleteContacts(ids: [$id])
      }
    `,
    appApi: true,
    typeName: 'Contact',
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
