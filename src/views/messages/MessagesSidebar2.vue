<template>
  <aside class="sidebar2" :class="{ 'sidebar2-full': !route.params.threadId }" :style="{ width: route.params.threadId ? mainStore.sidebar2Width + 'px' : undefined }">
    <div class="top-app-bar">
      <div class="title">
        <span>{{ $t('page_title.conversations') }} ({{ total.toLocaleString() }})</span>
      </div>
      <div class="actions">
        <v-dropdown v-model="sortMenuVisible">
          <template #trigger>
            <v-icon-button v-tooltip="$t('sort')">
              <i-material-symbols:sort-rounded />
            </v-icon-button>
          </template>
          <div
            v-for="item in sortItems"
            :key="item.value"
            class="dropdown-item"
            :class="{ selected: item.value === mainStore.conversationSortBy }"
            @click="mainStore.conversationSortBy = item.value; sortMenuVisible = false"
          >
            {{ $t(item.label) }}
          </div>
        </v-dropdown>
        <v-icon-button v-tooltip="$t('export_sms')" @click.stop="openExport">
          <i-material-symbols:download-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('send_sms')" @click.stop="openSendSms()">
          <i-material-symbols:sms-outline-rounded />
        </v-icon-button>
      </div>
    </div>
    <div v-if="loading && conversations.length === 0" class="scroller">
      <section v-for="i in 20" :key="i" class="conversation-item selectable-card-skeleton">
        <div class="title">
          <div class="skeleton-text text lg" style="width: 50%"></div>
        </div>
        <div class="subtitle">
          <div class="skeleton-text" style="width: 60%"></div>
        </div>
      </section>
    </div>
    <VirtualList v-if="conversations.length > 0" class="scroller" :data-key="'id'" :data-sources="sortedConversations" :estimate-size="80" @tobottom="loadMore">
      <template #item="{ index, item }">
        <a
          class="item-link"
          :href="`/messages/${item.id}`"
          @click.prevent="openConversation(item)"
        >
          <article
            class="conversation-item selectable-card"
            :class="{ selected: item.id == route.params.threadId }"
          >
            <div class="title">
              <span class="number"><field-id :id="index + 1" :raw="item" /></span>
              <div class="text">{{ getDisplayName(item.address) }}<span class="count">({{ item.messageCount.toLocaleString() }})</span></div>
              <span v-tooltip="formatDateTime(item.date)" class="time">{{ formatTimeAgo(item.date) }}</span>
            </div>
            <div class="subtitle">
              {{ item.snippet || '-' }}
            </div>
          </article>
        </a>
      </template>
      <template #footer>
        <v-circular-progress v-if="!noMore" indeterminate class="sm" />
      </template>
    </VirtualList>

    <div v-if="!loading && conversations.length === 0" class="no-data-placeholder">
      {{ $t(noDataKey(loading, app.permissions, 'READ_SMS')) }}
    </div>
    <div class="sidebar-drag-indicator" @mousedown="resizeWidth"></div>
  </aside>
</template>

<script setup lang="ts">
import { formatTimeAgo, formatDateTime } from '@/lib/format'
import { noDataKey } from '@/lib/list'
import VirtualList from '@/components/virtualscroll'
import { sortItems, useMessagesSidebar } from '@/hooks/messages-sidebar'

const {
  mainStore, app, route, sortMenuVisible,
  total, noMore, conversations, sortedConversations, loading,
  getDisplayName, resizeWidth,
  loadMore, openConversation, openSendSms, openExport,
} = useMessagesSidebar()
</script>

<style scoped lang="scss">
.sidebar2 {
  position: relative;
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--pl-top-app-bar-height));

  &.sidebar2-full {
    flex: 1;
  }
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

.conversation-item {
  margin: 0 16px 8px 16px;
  display: grid;
  box-sizing: border-box;
  border-radius: 8px;
  grid-template-areas:
    'title'
    'subtitle';
  grid-template-columns: 1fr;

  &:hover {
    cursor: pointer;
  }

  .title {
    grid-area: title;
    display: flex;
    align-items: center;

    .number {
      min-width: 40px;
      text-align: center;
      flex-shrink: 0;
    }

    .text {
      font-weight: 500;
      flex: 1;
      width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-block: 8px;
      margin-inline-end: 8px;

      .count {
        font-weight: 400;
        color: var(--md-sys-color-on-surface-variant);
        margin-inline-start: 4px;
        font-size: 0.875rem;
      }
    }

    .time {
      flex-shrink: 0;
      font-size: 0.75rem;
      color: var(--md-sys-color-on-surface-variant);
      margin-inline-end: 12px;
    }
  }

  .subtitle {
    font-size: 0.875rem;
    grid-area: subtitle;
    align-items: end;
    margin-block-end: 12px;
    margin-inline-end: 16px;
    margin-inline-start: 40px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--md-sys-color-on-surface-variant);
  }
}
</style>
