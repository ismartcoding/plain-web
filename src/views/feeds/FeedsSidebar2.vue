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
            @click.stop.prevent="handleItemClick($event, item, index, () => { view(item) })"
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
            <img v-if="item.image" class="image" :src="getFileUrl(item.image, '&w=512&h=512')" />
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
import { inject } from 'vue'
import { formatTimeAgo, formatDateTime } from '@/lib/format'
import { noDataKey } from '@/lib/list'
import { getFileUrl } from '@/lib/api/file'
import { useMainStore } from '@/stores/main'
import VirtualList from '@/components/virtualscroll'
import { useFeedEntriesData } from './hooks/useFeedEntriesData'
import { useFeedEntriesActions } from './hooks/useFeedEntriesActions'

const isPhone = inject('isPhone')
const mainStore = useMainStore()

const {
  items, filter, q, tags, feedsMap, feedsSyncing,
  listLoading, loadMore, noMore, fetch, dataType, route, limit, resizeWidth,
  selectedIds, allChecked, realAllChecked, selectRealAll, allCheckedAlertVisible,
  clearSelection, toggleAllChecked, toggleSelect, total, checked,
  shiftEffectingIds, handleItemClick, handleMouseOver, shouldSelect,
} = useFeedEntriesData(() => {
  deleteItems(selectedIds.value, realAllChecked.value, total.value, q.value)
})

const {
  addToTags, deleteItems, saveFeedsToNotes, savingNotes, syncFeeds,
  viewUrl, view, viewFeed,
} = useFeedEntriesActions({ selectedIds, realAllChecked, q, total, tags, items, clearSelection, fetch })
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
    .checkbox {
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
