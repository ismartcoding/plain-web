<template>
  <aside class="sidebar2">
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
      <md-circular-progress indeterminate class="spinner-sm" v-if="syncing" />
      <button class="icon-button btn-icon" v-else :disabled="syncing" v-tooltip="$t('sync_feeds')" @click.prevent="syncFeeds">
        <md-ripple />
        <i-material-symbols:sync-rounded />
      </button>
      <search-input ref="searchInputRef" v-model="q" :search="doSearch" v-if="showSearch">
        <template #filters>
          <div class="filters">
            <md-outlined-text-field :label="$t('keywords')" v-model="filter.text" keyup.enter="applyAndDoSearch" />
            <label class="form-label">{{ $t('tags') }}</label>
            <md-chip-set>
              <md-filter-chip v-for="item in tags" :key="item.id" :label="item.name" :selected="filter.tags.includes(item)" @click="onTagSelect(item)" />
            </md-chip-set>
            <div class="buttons">
              <md-filled-button @click.stop="applyAndDoSearch">
                {{ $t('search') }}
              </md-filled-button>
            </div>
          </div>
        </template>
      </search-input>
      <button class="icon-button btn-icon" v-else v-tooltip="$t('search')" @click.prevent="backToSearch">
        <md-ripple />
        <i-material-symbols:search-rounded />
      </button>
    </div>
    <all-checked-alert :limit="limit" :total="total" :all-checked-alert-visible="allCheckedAlertVisible" :real-all-checked="realAllChecked" :select-real-all="selectRealAll" :clear-selection="clearSelection" />
    <DynamicScroller :items="items" :min-item-size="54" class="scroller">
      <template v-slot="{ item, index, active }">
        <DynamicScrollerItem :item="item" :active="active" :size-dependencies="[item.title, item.description]" :data-index="index">
          <a class="item-link" :href="viewUrl(item)" @click.stop.prevent="view(item)">
            <article class="card feed-item" :class="{ selected: item.id == $route.params['id'] }">
              <div class="title">{{ item.title }}</div>
              <img v-if="item.image" :src="getFileUrl(item.image, '&w=200&h=200')" />
              <div class="subtitle">{{ getSummary(item.description) }}</div>
              <div class="title3">
                <a @click.stop.prevent="viewFeed(feedsMap[item.feedId])">{{ feedsMap[item.feedId].name }}</a><span>&nbsp;&nbsp;·&nbsp;&nbsp;</span> 
                <span v-tooltip="formatDateTimeFull(item.publishedAt)">
                  {{ formatDateTime(item.publishedAt) }}
                </span>
                <item-tags :tags="item.tags" :type="dataType" />
              </div>
            </article>
          </a>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>
  </aside>
</template>

<script setup lang="ts">
import { getFileUrl } from '@/lib/api/file'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { initQuery, feedsTagsGQL, initLazyQuery, feedEntriesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import router, { replacePath, replacePathNoReload } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import type { ITag, IFeedEntryItem, IFeedEntry, IFeed, IFeedEntryFilter, IItemsTagsUpdatedEvent, IItemTagsUpdatedEvent } from '@/lib/interfaces'
import { buildFilterQuery, buildQuery, parseQuery } from '@/lib/search'
import { kebabCase, remove, replace } from 'lodash-es'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useDelete, useSelectable } from '../views/hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags } from '../views/hooks/tags'
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
const feedsMap = computed(() => {
  const map: Record<string, IFeed> = {}
  feeds.value.forEach((it) => {
    map[it.id] = it
  })
  return map
})
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { addToTags } = useAddToTags(dataType, items, tags)
const { deleteItems } = useDelete(
  deleteFeedEntriesGQL,
  () => {
    clearSelection()
    refetch()
    if (items.value.some((it) => it.tags.length)) {
      emitter.emit('refetch_tags', dataType)
    }
  },
  items
)

const syncing = ref(false)
const showSearch = computed(() => {
  return router.currentRoute.value.path === '/feeds'
})

const { allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible, clearSelection, toggleAllChecked, toggleItemChecked, toggleRow, total, checked } = useSelectable(items)
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
      clearSelection()
      total.value--
      if (item.tags.length) {
        emitter.emit('refetch_tags', dataType)
      }
    },
  })
}

function getSummary(description: string): string {
  // Define the regex to match patterns like ![text](url) or ![text][ref]
  var regex = /!\[.*?\]\(.*?\)|!\[.*?\]\[.*?\]/g

  // Replace the matched patterns with an empty string and trim leading whitespace
  return description.replace(regex, '').replace(/^\s*/, '')
}

function backToSearch() {
  const q = route.query.q
  if (q) {
    replacePath(mainStore, `/feeds?q=${q}`)
    return
  }
  replacePath(mainStore, `/feeds`)
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

onMounted(() => {
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('feeds_fetched', feedsFetchedHandler)
})

onUnmounted(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('feeds_fetched', feedsFetchedHandler)
})

function view(item: IFeedEntry) {
  replacePath(mainStore, viewUrl(item))
}

function viewFeed(item: IFeed) {
  const q = buildQuery([
    {
      name: 'feed',
      op: '',
      value: kebabCase(item.name),
    },
  ])
  replacePath(mainStore, `/feeds?q=${encodeBase64(q)}`)
}

function viewUrl(item: IFeedEntry) {
  const q = route.query.q
  if (q) {
    return `/feeds/${item.feedId}/entries/${item.id}?q=${q}`
  }

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
<style scoped lang="scss">
.scroller {
  height: calc(100% - 64px);
  .item-link {
    text-decoration: none;
    display: block;
    padding: 0 16px 8px 16px;
  }
}
.v-toolbar {
  padding: 16px 16px 8px 16px;
}

.feed-item {
  display: grid;
  grid-template-areas:
    'title img'
    'subtitle img'
    'title3 title3';
  grid-template-columns: 1fr auto;
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
  }
  .subtitle {
    font-size: 0.875rem;
    max-height: 40px;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-block-end: 8px;
    grid-area: subtitle;
  }
  .title3 {
    font-size: 0.875rem;
    color: var(--md-sys-color-secondary);
    grid-area: title3;
    display: flex;
    flex-direction: row;
    .tags {
      margin-inline-start: 8px;
    }
  }
}
</style>
