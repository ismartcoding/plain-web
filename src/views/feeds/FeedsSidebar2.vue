<template>
  <aside class="sidebar2" :style="{ width: route.params.id ? mainStore.sidebar2Width + 'px' : 'auto' }">
    <div class="top-app-bar">
      <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="toggleAllChecked" />
      <div class="title">
        <span v-if="selectedIds.length">{{ $t('x_selected', { count: realAllChecked ? total.toLocaleString() : selectedIds.length.toLocaleString() }) }}</span>
        <span v-else>{{ $t('page_title.feeds') }} ({{ total.toLocaleString() }})</span>
        <template v-if="checked">
          <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItems(selectedIds, realAllChecked, total, q)">
            <i-material-symbols:delete-forever-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addToTags(selectedIds, realAllChecked, q)">
            <i-material-symbols:label-outline-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('save_to_notes')" :loading="savingNotes" @click.prevent="saveFeedsToNotes">
            <i-material-symbols:add-notes-outline-rounded />
          </v-icon-button>
        </template>
      </div>

      <div class="actions">
        <v-icon-button v-tooltip="$t('sync_feeds')" :loading="feedsSyncing" @click.prevent="syncFeeds">
          <i-material-symbols:sync-rounded />
        </v-icon-button>
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
    <div v-if="listLoading && items.length === 0" class="scroller">
      <FeedSkeletonItem v-for="i in 20" :key="i" :index="i" :is-phone="isPhone" />
    </div>
    <VirtualList v-if="items.length > 0" class="scroller" :data-key="'id'" :data-sources="items" :estimate-size="100" @tobottom="loadMore">
      <template #item="{ index, item }">
        <a class="item-link" :href="viewUrl(item)">
          <article
            class="feed-item selectable-card"
            :class="{ selected: selectedIds.includes(item.id) || item.id == $route.params['id'], selecting: shiftEffectingIds.includes(item.id) }"
            @click.stop.prevent="
              handleItemClick($event, item, index, () => {
                view(item)
              })
            "
            @mouseenter.stop="handleMouseOver($event, index)"
          >
            <div class="title">
              <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, index)" />
              <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, index)" />
              <div class="text">{{ item.title || $t('no_content') }}</div>
            </div>
            <div class="subtitle">
              <span class="number"><field-id :id="index + 1" :raw="item" /></span>
              <div class="info">
                <a @click.stop.prevent="viewFeed(feedsMap[item.feedId])">{{ feedsMap[item.feedId]?.name }}</a>
                <span>·</span>
                <span v-tooltip="formatDateTime(item.publishedAt)" class="time">
                  {{ formatTimeAgo(item.publishedAt) }}
                </span>
                <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
              </div>
            </div>
            <v-icon-button v-tooltip="$t('actions')" style="display: none">
              <i-material-symbols:more-vert />
            </v-icon-button>
            <img v-if="item.image" class="image" :src="getFileUrl(item.image, '&w=200&h=200')" />
          </article>
        </a>
      </template>
      <template #footer>
        <v-circular-progress v-if="!noMore" indeterminate class="sm" />
      </template>
    </VirtualList>

    <div v-if="!listLoading && items.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(listLoading)) }}
    </div>
    <div class="sidebar-drag-indicator" @mousedown="resizeWidth"></div>
  </aside>
</template>

<script setup lang="ts">
import { computed, inject, onActivated, onDeactivated, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatTimeAgo, formatDateTime } from '@/lib/format'
import { feedsTagsGQL, initLazyQuery } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import type { ITag, IFeedEntry, IFeed, IItemsTagsUpdatedEvent, IItemTagsUpdatedEvent, IFilter } from '@/lib/interfaces'
import { noDataKey } from '@/lib/list'
import { useFeeds } from '@/hooks/feeds'
import { useDelete, useSelectable } from '@/hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags } from '@/hooks/tags'
import { deleteFeedEntriesGQL, initMutation, saveFeedEntriesToNotesGQL, syncFeedsGQL } from '@/lib/api/mutation'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import gql from 'graphql-tag'
import { getFileUrl } from '@/lib/api/file'
import VirtualList from '@/components/virtualscroll'
import { DataType } from '@/lib/data'
import { useList } from '@/hooks/feed-entries'
import { useSearch } from '@/hooks/search'
import { decodeBase64 } from '@/lib/strutil'
import { useKeyEvents } from '@/hooks/key-events'
import { useLeftSidebarResize } from '@/hooks/sidebar'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'

const isPhone = inject('isPhone')
const mainStore = useMainStore()
const { feedsSyncing } = storeToRefs(useTempStore())
const { t } = useI18n()
const filter = reactive<IFilter>({
  tagIds: [],
})
const { parseQ } = useSearch()
const dataType = DataType.FEED_ENTRY
const route = useRoute()
const page = ref(1)
const limit = 100
const tags = ref<ITag[]>([])
const feeds = ref<IFeed[]>([])
const feedsMap = computed(() => {
  const map: Record<string, IFeed> = {}
  feeds.value.forEach((it) => {
    map[it.id] = it
  })
  return map
})
const items = ref<IFeedEntry[]>([])
const q = ref('')
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
const gotoPage = (value: number) => {
  page.value = value
  const q = route.query.q
  replacePath(mainStore, q ? `/feeds?page=${value}&q=${q}` : `/feeds?page=${value}`)
}
const { keyDown: pageKeyDown, keyUp: pageKeyUp } = useKeyEvents(total, limit, page, selectAll, clearSelection, gotoPage, () => {
  deleteItems(selectedIds.value, realAllChecked.value, total.value, q.value)
})
const { page: listPage, loading: listLoading, loadMore, fetch: fetchList, noMore } = useList(items, q, total)
const { addToTags } = useAddToTags(dataType, tags)
const fetch = () => {
  listPage.value = 1
  fetchList()
}
const { deleteItems } = useDelete(deleteFeedEntriesGQL, () => {
  clearSelection()
  fetch()
  if (items.value.some((it) => it.tags.length)) {
    emitter.emit('refetch_tags', dataType)
  }
  emitter.emit('feed_entries_deleted')
})

const isDetail = computed(() => {
  const path = router.currentRoute.value.path
  return path !== '/feeds'
})

const { resizeWidth } = useLeftSidebarResize(
  300,
  () => {
    return mainStore.sidebar2Width
  },
  (width: number) => {
    mainStore.sidebar2Width = width
  }
)

function deleteItem(item: IFeedEntry) {
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

const {
  mutate: saveToNotes,
  loading: savingNotes,
  onDone: onSaveToNotesDone,
} = initMutation({
  document: saveFeedEntriesToNotesGQL,
})

function saveFeedsToNotes() {
  if (!realAllChecked.value) {
    if (selectedIds.value.length === 0) {
      toast(t('select_first'), 'error')
      return
    }
    saveToNotes({ query: `ids:${selectedIds.value.join(',')}` })
  } else {
    saveToNotes({ query: q.value })
  }
}

onSaveToNotesDone(() => {
  toast(t('saved'))
})

function backToList() {
  const q = route.query.q
  if (q) {
    replacePath(mainStore, `/feeds?q=${q}`)
  } else {
    replacePath(mainStore, `/feeds`)
  }
}


const { fetch: fetchFeedsTags } = initLazyQuery({
  handle: async (data: { tags: ITag[]; feeds: IFeed[] }, error: string) => {
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
})

function addItemToTags(item: IFeedEntry) {
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
})

function syncFeeds() {
  feedsSyncing.value = true
  doSyncFeeds({ id: '' })
}

const feedsFetchedHandler = (data: any) => {
  feedsSyncing.value = false
  fetch()
  if (data.error) {
    toast(data.error, 'error')
  } else {
    toast(t('feeds_synced'))
  }
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

const isActive = ref(false)

function applyRouteQuery() {
  const nextPage = parseInt(route.query.page?.toString() ?? '1')
  page.value = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1
  q.value = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q.value)
  fetch()
}

watch(
  () => route.fullPath,
  () => {
    if (!isActive.value) return
    applyRouteQuery()
  }
)

onActivated(() => {
  const scroller = document.getElementsByClassName('scroller')?.[0]
  if (scroller) {
    scroller.scrollTop = 0
  }
  fetchFeedsTags()
  isActive.value = true
  applyRouteQuery()
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.on('feeds_fetched', feedsFetchedHandler)
  window.addEventListener('keydown', pageKeyDown)
  window.addEventListener('keyup', pageKeyUp)
})

onDeactivated(() => {
  isActive.value = false
  listPage.value = 1
  noMore.value = false
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
  emitter.off('feeds_fetched', feedsFetchedHandler)
  window.removeEventListener('keydown', pageKeyDown)
  window.removeEventListener('keyup', pageKeyUp)
})
</script>
<style scoped lang="scss">
.sidebar2 {
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--pl-top-app-bar-height));
}
.scroller {
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
  .item-link {
    text-decoration: none;
    display: block;
  }
}

:deep(.feed-item) {
  margin: 0 16px 8px 16px;
  display: grid;
  box-sizing: border-box;
  border-radius: 8px;
  grid-template-areas:
    'title image'
    'subtitle image';
  grid-template-columns: 1fr auto;
  &:hover {
    cursor: pointer;
  }
  .title {
    grid-area: title;
    display: flex;
    .v-checkbox {
      margin-inline-start: 4px;
    }
    .text {
      font-weight: 500;
      flex: 1;
      width: 0;
      margin-block: 8px;
      margin-inline-end: 12px;
    }
  }
  .subtitle {
    font-size: 0.875rem;
    grid-area: subtitle;
    display: flex;
    flex-direction: row;
    align-items: end;
    margin-block-end: 12px;
    margin-inline-end: 16px;
    margin-inline-start: 4px;
    .number {
      min-width: 40px;
      text-align: center;
    }
    .info {
      display: flex;
      gap: 4px;
      flex: 1;
      flex-flow: wrap;
      align-items: center;
    }
  }
  .image {
    width: 50px;
    height: 50px;
    grid-area: image;
    object-fit: cover;
    border-radius: 8px;
    margin-block: 12px;
    margin-inline-end: 12px;
  }
}
.drag-indicator {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 16px;
  cursor: col-resize;
}
</style>
