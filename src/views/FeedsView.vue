<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.feeds')} (${total})`" />
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
    <md-outlined-button :disabled="syncing" @click.prevent="syncFeeds">
      {{ syncing ? $t('syncing') : $t('sync_feeds') }}
    </md-outlined-button>
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
          <th></th>
          <th>{{ $t('title') }}</th>
          <th></th>
          <th>{{ $t('source') }}</th>
          <th>{{ $t('tags') }}</th>
          <th>{{ $t('published_at') }}</th>
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
          <td><field-id :id="item.id" :raw="item" /></td>
          <td>
            <img v-if="item.image" :src="getFileUrl(item.image) + '&w=300&h=300'" width="50" height="50" />
          </td>
          <td>
            <a :href="viewUrl(item)" @click.prevent="view(item)">{{ item.title || $t('no_content') }}</a>
          </td>
          <td class="nowrap">
            <div class="action-btns">
              <button class="icon-button" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
                <md-ripple />
                <i-material-symbols:delete-forever-outline-rounded />
              </button>
              <button class="icon-button" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                <md-ripple />
                <i-material-symbols:label-outline-rounded />
              </button>
            </div>
          </td>
          <td class="nowrap">{{ item.author }}</td>
          <td>
            <item-tags :tags="item.tags" :type="dataType" />
          </td>
          <td class="nowrap">
            <span v-tooltip="formatDateTimeFull(item.publishedAt)">
              {{ formatDateTime(item.publishedAt) }}
            </span>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="!items.length">
        <tr>
          <td colspan="8">
            <div class="no-data-placeholder">
              {{ $t(noDataKey(loading)) }}
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { getFileUrl } from '@/lib/api/file'
import { nextTick, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { initQuery, feedsTagsGQL, initLazyQuery, feedEntriesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import type {
  ITag,
  IFeedEntryItem,
  IFeedEntry,
  IFeed,
  IFeedEntryFilter,
  IItemsTagsUpdatedEvent,
  IItemTagsUpdatedEvent,
} from '@/lib/interfaces'
import { buildFilterQuery, buildQuery, parseQuery } from '@/lib/search'
import { kebabCase, remove } from 'lodash-es'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useDelete, useSelectable } from './hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags } from './hooks/tags'
import { deleteFeedEntriesGQL, initMutation, syncFeedsGQL } from '@/lib/api/mutation'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import gql from 'graphql-tag'
import { DataType } from '@/lib/data'

const mainStore = useMainStore()
const items = ref<IFeedEntryItem[]>([])
const searchInputRef = ref()
const { t } = useI18n()
const filter: IFeedEntryFilter = reactive({
  text: '',
  feeds: [],
  tags: [],
})

const dataType = DataType.FEED_ENTRY
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const tags = ref<ITag[]>([])
const feeds = ref<IFeed[]>([])
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { addToTags } = useAddToTags(dataType, items, tags)
const { deleteItems } = useDelete(
  deleteFeedEntriesGQL,
  () => {
    refetch()
    if (items.value.some((it) => it.tags.length)) {
      emitter.emit('refetch_tags', dataType)
    }
  },
  items
)
const syncing = ref(false)

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
        items.value = data.feedEntries.map((it: IFeedEntry) => ({ ...it, checked: false }))
        total.value = data.feedEntryCount
      }
    }
  },
  document: feedEntriesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

function deleteItem(item: IFeedEntryItem) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.title,
    gql: gql`
      mutation deleteFeedEntry($query: String!) {
        deleteFeedEntries(query: $query)
      }
    `,
    variables: () => ({
      query: `ids:${item.id}`,
    }),
    appApi: true,
    typeName: 'FeedEntry',
    done: () => {
      total.value--
      if (item.tags.length) {
        emitter.emit('refetch_tags', dataType)
      }
    },
  })
}

initQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        tags.value = data.tags
        feeds.value = data.feeds
        const fields = parseQuery(q.value as string)
        filter.tags = []
        const tagIds: string[] = []
        const feedIds: string[] = []
        fields.forEach((it) => {
          if (it.name === 'text') {
            filter.text = it.value
          } else if (it.name === 'tag') {
            const tag = data.tags.find((t: ITag) => kebabCase(t.name) === it.value)
            if (tag) {
              filter.tags.push(tag)
              tagIds.push(tag.id)
            } else {
              tagIds.push('invalid')
            }
          } else if (it.name === 'feed') {
            const feed = data.feeds.find((t: IFeed) => kebabCase(t.name) === it.value)
            if (feed) {
              filter.feeds.push(feed)
              feedIds.push(feed.id)
            } else {
              feedIds.push('invalid')
            }
          }
        })
        const newFields = [...fields].filter((it) => it.name !== 'tag' && it.name !== 'feed')
        tagIds.forEach((it) => {
          newFields.push({
            name: 'tag_id',
            op: '',
            value: it,
          })
        })

        feedIds.forEach((it) => {
          newFields.push({
            name: 'feed_id',
            op: '',
            value: it,
          })
        })

        finalQ.value = buildQuery(newFields)
        await nextTick()
        load()
      }
    }
  },
  document: feedsTagsGQL,
  variables: {
    type: dataType,
  },
  appApi: true,
})

function addItemToTags(item: IFeedEntryItem) {
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

watch(page, (value: number) => {
  replacePath(mainStore, `/feeds?page=${value}&q=${encodeBase64(q.value)}`)
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

function doSearch() {
  replacePath(mainStore, `/feeds?q=${encodeBase64(q.value)}`)
}

const feedsFetchedHandler = (data: any) => {
  syncing.value = false
  toast(data.error || t('feeds_synced'))
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
  emitter.on('feeds_fetched', feedsFetchedHandler)
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('feeds_fetched', feedsFetchedHandler)
})

function view(item: IFeedEntry) {
  router.push(viewUrl(item))
}

function viewUrl(item: IFeedEntry) {
  return `/feeds/${item.feedId}/entries/${item.id}`
}

const { mutate: doSyncFeeds } = initMutation({
  document: syncFeedsGQL,
  appApi: true,
})

function syncFeeds() {
  syncing.value = true
  doSyncFeeds({ id: '' })
}
</script>
