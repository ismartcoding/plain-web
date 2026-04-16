<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="content">
    <feed-entry-skeleton-view v-if="loading && !entry" />
    <article v-else-if="entry">
      <feed-entry-toolbar
        :entry="entry"
        :data-type="dataType"
        :sync-content-loading="syncContentLoading"
        :is-phone="isPhone"
        @view-feed="viewFeed"
        @add-to-tags="addToTags"
        @sync-content="syncContent"
        @save-to-notes="saveToNotes({ query: `ids:${id}` })"
        @print="print"
        @decrease-font-size="mainStore.decreaseFeedEntryFontSize"
        @increase-font-size="mainStore.increaseFeedEntryFontSize"
        @reset-font-size="mainStore.resetFeedEntryFontSize"
        @close="backToList"
      />
      <div class="article-title" :style="{ fontSize: (mainStore.feedEntryFontSize * 1.5) + 'px' }">
        {{ entry?.title }}
      </div>
      <div class="md-container" :style="{ fontSize: mainStore.feedEntryFontSize + 'px' }" v-html="markdown"></div>
    </article>
  </div>
</template>

<script setup lang="ts">
import FeedEntryToolbar from '@/views/feeds/FeedEntryToolbar.vue'
import { useFeedEntry } from '@/hooks/feed-entry'

const {
  id, entry, markdown, loading, isPhone, dataType, mainStore,
  syncContentLoading, viewFeed, addToTags, syncContent, saveToNotes, print, backToList,
} = useFeedEntry()
</script>
<style lang="scss">
.page-content .main-feed-entry {
  flex-direction: row;

  .content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    width: 0px; // fix flexbox overflow
    padding: 0 16px 0 8px;
    .top-app-bar {
      padding-inline: 0;
    }
  }
}
</style>
<style lang="scss" scoped>
.article-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 16px;
}
</style>
