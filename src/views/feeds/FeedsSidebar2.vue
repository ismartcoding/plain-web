<template>
  <aside class="sidebar2" v-show="showSidebar">
    <div class="top-app-bar">
      <div class="title">{{ $t('page_title.feeds') }} ({{ total.toLocaleString() }})</div>
      <div class="actions">
        <search-input :filter="filter" :tags="tags" :feeds="feeds" :show-chips="!isDetail" :get-url="getUrl" :show-today="true" />
        <template v-if="checked">
          <button class="btn-icon" @click.stop="deleteItems(realAllChecked, q)" v-tooltip="$t('delete')">
            <md-ripple />
            <i-material-symbols:delete-forever-outline-rounded />
          </button>
          <button class="btn-icon" @click.stop="addToTags(tableItems, realAllChecked, q)" v-tooltip="$t('add_to_tags')">
            <md-ripple />
            <i-material-symbols:label-outline-rounded />
          </button>
        </template>
        <button class="btn-icon" @click.prevent="toggleViewType" v-tooltip="$t(mainStore.feedsTableView ? 'view_as_list' : 'view_as_table')">
          <md-ripple />
          <i-material-symbols:table-rows-outline v-if="mainStore.feedsTableView" />
          <i-material-symbols:table v-else />
        </button>
        <md-circular-progress indeterminate class="spinner-sm" v-if="syncing" />
        <button class="btn-icon" v-else :disabled="syncing" v-tooltip="$t('sync_feeds')" @click.prevent="syncFeeds">
          <md-ripple />
          <i-material-symbols:sync-rounded />
        </button>
      </div>
    </div>
    <template v-if="mainStore.feedsTableView">
      <all-checked-alert :limit="limit" :total="total" :all-checked-alert-visible="allCheckedAlertVisible" :real-all-checked="realAllChecked" :select-real-all="selectRealAll" :clear-selection="clearSelection" />
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>
                <md-checkbox touch-target="wrapper" @change="toggleAllChecked" :checked="allChecked" :indeterminate="!allChecked && checked" />
              </th>
              <th></th>
              <th>{{ $t('title') }}</th>
              <th></th>
              <th>{{ $t('source') }}</th>
              <th>{{ $t('tags') }}</th>
              <th>{{ $t('published_at') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in tableItems" :key="item.id" :class="{ selected: item.checked }" @click.stop="toggleRow(item)">
              <td><md-checkbox touch-target="wrapper" @change="toggleItemChecked" :checked="item.checked" /></td>
              <td>
                <img v-if="item.image" :src="getFileUrl(item.image, '&w=200&h=200')" width="50" height="50" />
              </td>
              <td style="min-width: 200px; cursor: pointer" @click.stop.prevent="view(item)">
                <a :href="viewUrl(item)" @click.stop.prevent="view(item)">{{ item.title || $t('no_content') }}</a>
              </td>
              <td class="nowrap">
                <div class="action-btns">
                  <button class="btn-icon sm" @click.stop="deleteItem(item)" v-tooltip="$t('delete')">
                    <md-ripple />
                    <i-material-symbols:delete-forever-outline-rounded />
                  </button>
                  <button class="btn-icon sm" @click.stop="addItemToTags(item)" v-tooltip="$t('add_to_tags')">
                    <md-ripple />
                    <i-material-symbols:label-outline-rounded />
                  </button>
                </div>
              </td>
              <td class="nowrap">
                <a @click.stop.prevent="viewFeed(feedsMap[item.feedId])">{{ feedsMap[item.feedId]?.name }}</a>
              </td>
              <td>
                <item-tags :tags="item.tags" :type="dataType" />
              </td>
              <td class="nowrap">
                <time v-tooltip="formatDateTime(item.publishedAt)">
                  {{ formatTimeAgo(item.publishedAt) }}
                </time>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="!tableItems.length">
            <tr>
              <td colspan="7">
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
    <VirtualList v-else class="scroller" :data-key="'id'" :data-sources="listItems" :estimate-size="100" @tobottom="loadMore">
      <template #item="{ index, item }">
        <a class="item-link" :href="viewUrl(item)" @click.stop.prevent="view(item)">
          <article class="card feed-item" :class="{ selected: item.id == $route.params['id'] }">
            <div class="grid1">
              <div class="title">{{ item.title || $t('no_content') }}</div>
              <img v-if="item.image" :src="getFileUrl(item.image, '&w=200&h=200')" />
            </div>
            <div class="grid2">
              <div class="subtitle">
                <span>{{ index + 1 }}&nbsp;&nbsp;·&nbsp;&nbsp;</span><a @click.stop.prevent="viewFeed(feedsMap[item.feedId])">{{ feedsMap[item.feedId]?.name }}</a
                ><span>&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                <span class="time" v-tooltip="formatDateTime(item.publishedAt)">
                  {{ formatTimeAgo(item.publishedAt) }}
                </span>
                <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
              </div>
              <button class="btn-icon sm" v-tooltip="$t('actions')" style="display: none">
                <md-ripple />
                <i-material-symbols:more-vert />
              </button>
            </div>
          </article>
        </a>
      </template>
      <template #footer>
        <md-circular-progress v-if="!noMore" indeterminate class="spinner-sm" />
      </template>
    </VirtualList>
  </aside>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatTimeAgo, formatDateTime } from '@/lib/format'
import { feedsTagsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import type { ITag, IFeedEntryItem, IFeedEntry, IFeed, IItemsTagsUpdatedEvent, IItemTagsUpdatedEvent, IFilter } from '@/lib/interfaces'
import { noDataKey } from '@/lib/list'
import { useFeeds } from '@/hooks/feeds'
import { useDelete, useSelectable } from '@/hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags } from '@/hooks/tags'
import { deleteFeedEntriesGQL, initMutation, syncFeedsGQL } from '@/lib/api/mutation'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import gql from 'graphql-tag'
import { getFileUrl } from '@/lib/api/file'
import VirtualList from '@/components/virtualscroll'
import { DataType } from '@/lib/data'
import { useList, useTable } from '@/hooks/feed-entries'
import { useSearch } from '@/hooks/search'
import { decodeBase64 } from '@/lib/strutil'

const mainStore = useMainStore()
const { t } = useI18n()
const filter = reactive<IFilter>({
  tagIds: [],
})
const { parseQ } = useSearch()
const dataType = DataType.FEED_ENTRY
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const tags = ref<ITag[]>([])
const feeds = ref<IFeed[]>([])
const feedsMap = computed(() => {
  const map: Record<string, IFeed> = {}
  feeds.value.forEach((it) => {
    map[it.id] = it
  })
  return map
})
const showSidebar = computed(() => !(route.params.id !== undefined && mainStore.feedsTableView))
const listItems = ref<IFeedEntryItem[]>([])
const tableItems = ref<IFeedEntryItem[]>([])
const q = ref('')
const { allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleItemChecked, toggleRow, total, checked } = useSelectable(tableItems)
const { page: listPage, loadMore, fetch: fetchList, noMore } = useList(listItems, q, total)
const { loading, fetch: fetchTable } = useTable(tableItems, q, total, page, limit)
const { addToTags } = useAddToTags(dataType, tags)
const fetch = () => {
  if (mainStore.feedsTableView) {
    fetchTable()
  } else {
    listPage.value = 1
    fetchList()
  }
}
const { deleteItems } = useDelete(
  deleteFeedEntriesGQL,
  () => {
    clearSelection()
    fetchTable()
    if (tableItems.value.some((it) => it.tags.length)) {
      emitter.emit('refetch_tags', dataType)
    }
  },
  tableItems
)

const syncing = ref(false)
const isDetail = computed(() => {
  const path = router.currentRoute.value.path
  return path !== '/feeds'
})

function toggleViewType() {
  mainStore.feedsTableView = !mainStore.feedsTableView
  fetch()
  if (route.params.id !== undefined) {
    backToList()
  }
}

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
      clearSelection()
      total.value--
      if (item.tags.length) {
        emitter.emit('refetch_tags', dataType)
      }
    },
  })
}

function backToList() {
  const q = route.query.q
  if (q) {
    replacePath(mainStore, `/feeds?q=${q}`)
  } else {
    replacePath(mainStore, `/feeds`)
  }
}

function getUrl(q: string) {
  return q ? `/feeds?q=${q}` : '/feeds'
}

const { fetch: fetchFeedsTags } = initLazyQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        tags.value = data.tags
        feeds.value = data.feeds
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

function viewUrl(item: IFeedEntry) {
  const q = router.currentRoute.value.query.q
  if (q) {
    return `/feeds/${item.feedId}/entries/${item.id}?q=${q}`
  }

  return `/feeds/${item.feedId}/entries/${item.id}`
}

function view(item: IFeedEntry) {
  replacePath(mainStore, viewUrl(item))
}

const { viewFeed } = useFeeds(mainStore)

const { mutate: doSyncFeeds } = initMutation({
  document: syncFeedsGQL,
  appApi: true,
})

function syncFeeds() {
  syncing.value = true
  doSyncFeeds({ id: '' })
}

const feedsFetchedHandler = (data: any) => {
  syncing.value = false
  toast(data.error || t('feeds_synced'))
}

const itemsTagsUpdatedHandler = (event: IItemsTagsUpdatedEvent) => {
  if (event.type === dataType) {
    clearSelection()
    fetchTable()
  }
}

const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
  if (event.type === dataType) {
    fetchTable()
  }
}

watch(page, (value: number) => {
  const q = route.query.q
  replacePath(mainStore, q ? `/feeds?page=${value}&q=${q}` : `/feeds?page=${value}`)
})

onActivated(() => {
  const scroller = document.getElementsByClassName('scroller')?.[0]
  if (scroller) {
    scroller.scrollTop = 0
  }
  q.value = decodeBase64(query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetchFeedsTags()
  fetch()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('feeds_fetched', feedsFetchedHandler)
})

onDeactivated(() => {
  listPage.value = 1
  noMore.value = false
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('feeds_fetched', feedsFetchedHandler)
})
</script>
<style lang="scss">
.main-feeds .alert-all-checked {
  margin-inline: 16px;
  margin-block-end: 8px;
}
</style>
<style scoped lang="scss">
.scroller {
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100vh - 122px);
  .item-link {
    text-decoration: none;
    display: block;
    padding: 0 16px 8px 16px;
  }
}

.feed-item {
  .grid1 {
    padding-inline-end: 8px;
    display: grid;
    grid-template-areas: 'title img';
    grid-template-columns: 1fr auto;
  }
  padding: 16px 8px 8px 16px;
  .title {
    font-weight: 500;
    text-decoration: none;
    display: block;
    margin-block-end: 8px;
    grid-area: title;
  }
  img {
    grid-area: img;
    width: 50px;
    height: 50px;
    border-radius: 8px;
    margin-inline-start: 8px;
    margin-block-end: 8px;
  }
  .grid2 {
    display: grid;
    grid-template-areas: 'subtitle actions';
    grid-template-columns: 1fr auto;
  }
  .subtitle {
    font-size: 0.875rem;
    color: var(--md-sys-color-secondary);
    grid-area: subtitle;
    display: flex;
    flex-direction: row;
    flex-flow: wrap;
    align-items: end;
    margin-block-end: 4px;
    .time {
      margin-inline-end: 8px;
    }
  }
  .btn-icon {
    grid-area: actions;
    margin-inline-start: auto;
    margin-block-start: 8px;
    margin-inline-end: 4px;
  }
}
.table-responsive {
  padding-inline: 16px;
}
</style>
