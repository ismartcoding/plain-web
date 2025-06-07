<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
    <div class="title">
      <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
      <span v-else>{{ $t('page_title.contacts') }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <button v-tooltip="$t('delete')" class="btn-icon" @click.stop="deleteItems(selectedIds, realAllChecked, total, q)">
          
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
        <button v-tooltip="$t('download')" class="btn-icon" style="display: none">
          
          <i-material-symbols:download-rounded />
        </button>
        <button v-tooltip="$t('add_to_tags')" class="btn-icon" @click.stop="addToTags(selectedIds, realAllChecked, q)">
          
          <i-material-symbols:label-outline-rounded />
        </button>
      </template>
    </div>
    <div class="actions">
      <search-input :filter="filter" :tags="tags" :get-url="getUrl" />
      <v-outlined-button class="btn-sm" @click="create">
        {{ $t('create') }}
      </v-outlined-button>
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
    <div class="contact-list" :class="{ 'select-mode': checked }">
      <section
        v-for="(item, i) in items"
        :key="item.id"
        class="contact-item selectable-card"
        :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
        @click.stop="handleItemClick($event, item, i, () => {})"
        @mouseover="handleMouseOver($event, i)"
      >
        <div class="start">
          <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, i)" />
          <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, i)" />
          <span class="number"><field-id :id="i + 1" :raw="item" /></span>
        </div>
        <img v-if="item.thumbnailId" class="image" :src="getFileUrl(item.thumbnailId)" width="50" />
        <i-material-symbols:contact-page-outline-rounded v-else class="image" />
        <div class="title">{{ fullName(item) }}</div>
        <div class="subtitle">
          <span v-if="item.notes">{{ item.notes }}</span>
          <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
        </div>
        <div class="info">
          <ul class="list-unstyled">
            <li v-for="(it, index) in item.phoneNumbers" :key="index" class="phone-number">
              {{ it.type > 0 ? $t(`contact.phone_number_type.${it.type}`) : it.label }}
              {{ it.normalizedNumber || it.value }}
              <v-circular-progress v-if="callLoading && callId === item.id && callIndex === index" indeterminate class="sm" />
              <button v-else v-tooltip="$t('make_a_phone_call')" class="btn-icon sm" @click.stop="call(item.id, it.normalizedNumber || it.value, index)">
                
                <i-material-symbols:call-outline-rounded />
              </button>
            </li>
            <li v-for="it in item.emails" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.email_type.${it.type}`) : it.label }} {{ it.value }}</li>
            <li v-for="it in item.addresses" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.address_type.${it.type}`) : it.label }} {{ it.value }}</li>
            <li v-for="it in item.websites" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.website_type.${it.type}`) : it.label }} {{ it.value }}</li>
            <li v-for="it in item.ims" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.im_type.${it.type}`) : it.label }} {{ it.value }}</li>
            <li v-for="it in item.events" :key="it.type + it.value">{{ it.type > 0 ? $t(`contact.event_type.${it.type}`) : it.label }} {{ it.value }}</li>
          </ul>
        </div>
        <div class="actions">
          <button v-tooltip="$t('delete')" class="btn-icon sm" @click.stop="deleteItem(item)">
            
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
          <button v-tooltip="$t('edit')" class="btn-icon sm" @click.stop="edit(item)">
            
            <i-material-symbols:edit />
          </button>
          <button v-tooltip="$t('add_to_tags')" class="btn-icon sm" @click.stop="addItemToTags(item)">
            
            <i-material-symbols:label-outline-rounded />
          </button>
        </div>
        <div class="time">
          <span v-tooltip="formatDateTime(item.updatedAt)">
            {{ formatTimeAgo(item.updatedAt) }}
          </span>
        </div>
      </section>
      <template v-if="loading && items.length === 0">
        <section v-for="i in 20" :key="i" class="contact-item selectable-card-skeleton">
          <div class="start">
            <div class="checkbox">
              <div class="skeleton-checkbox"></div>
            </div>
            <span class="number">{{ i }}</span>
          </div>
          <div class="image">
            <div class="skeleton-image"></div>
          </div>
          <div class="title">
            <div class="skeleton-text skeleton-title"></div>
          </div>
          <div class="subtitle">
            <div class="skeleton-text skeleton-subtitle"></div>
          </div>
          <div class="info">
            <div class="skeleton-text skeleton-info"></div>
          </div>
          <div class="actions">
            <div class="skeleton-text skeleton-actions"></div>
          </div>
          <div class="time">
            <div class="skeleton-text skeleton-time"></div>
          </div>
        </section>
      </template>
    </div>
    <div v-if="!loading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'WRITE_CONTACTS')) }}
    </div>
    <v-pagination v-if="total > limit" :page="page" :go="gotoPage" :total="total" :limit="limit" />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onDeactivated, reactive, ref } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
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
  replacePath(mainStore, q ? `/contacts?page=${page}&q=${q}` : `/contacts?page=${page}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  deleteItems(selectedIds.value, realAllChecked.value, total.value, q.value)
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
.contact-item {
  display: grid;
  border-radius: 8px;
  grid-template-areas:
    'start image title info actions time'
    'start image subtitle info actions time';
  grid-template-columns: 48px 50px minmax(100px, 1fr) 1fr 1fr minmax(64px, 1fr);
  .start {
    grid-area: start;
  }
  .number {
    font-size: 0.75rem;
    display: flex;
    justify-content: center;
  }
  .image {
    width: 50px;
    height: 50px;
    grid-area: image;
    object-fit: cover;
    border-radius: 8px;
    margin-block: 12px;
  }
  .title {
    grid-area: title;
    font-weight: 500;
    margin-inline: 16px;
    padding-block-start: 12px;
  }
  .subtitle {
    grid-area: subtitle;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 0.875rem;
    margin-inline: 16px;
  }
  .info {
    grid-area: info;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-inline: 16px;
    padding-block: 12px;
    justify-content: center;
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
  .time {
    grid-area: time;
    display: flex;
    align-items: center;
    padding-inline: 16px;
    justify-content: end;
  }
}
.contact-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.contact-list.select-mode {
  .media-item {
    cursor: pointer;
    .actions {
      visibility: hidden;
    }
  }
}

.contact-list {
  .contact-item {
    .skeleton-image {
      width: 50px;
      height: 50px;
    }
    .skeleton-title {
      width: 50%;
      height: 24px;
    }
    .skeleton-subtitle {
      width: 40%;
      height: 20px;
    }
    .skeleton-actions {
      width: 120px;
      height: 20px;
    }
    .skeleton-info {
      width: 180px;
      height: 20px;
    }
    .skeleton-time {
      width: 60px;
      height: 20px;
    }
  }
}
</style>
