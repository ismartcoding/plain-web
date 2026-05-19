<template>
  <div class="feed-entry-toolbar">
    <div class="top-app-bar">
      <div class="title">
        <a v-if="entry.feed" @click.stop.prevent="$emit('viewFeed', entry.feed)">{{ entry.feed.name }}</a>
        <time v-if="entry" v-tooltip="formatDateTime(entry.publishedAt)">
          {{ formatTimeAgo(entry.publishedAt) }}
        </time>
        <item-tags :tags="entry?.tags" :type="dataType" />
        <feed-entry-action-buttons
          v-if="!isPhone"
          :entry="entry"
          :tags="tags"
          :data-type="dataType"
          :sync-content-loading="syncContentLoading"
          @sync-content="$emit('syncContent')"
          @save-to-notes="$emit('saveToNotes')"
          @print="$emit('print')"
          @decrease-font-size="$emit('decreaseFontSize')"
          @increase-font-size="$emit('increaseFontSize')"
          @reset-font-size="$emit('resetFontSize')"
        />
      </div>
      <div class="actions">
        <button v-tooltip="$t('close')" class="btn-icon" @click.prevent="$emit('close')">
          <i-material-symbols:close-rounded />
        </button>
      </div>
    </div>
    <div v-if="isPhone" class="action-buttons-row">
      <feed-entry-action-buttons
        :entry="entry"
        :tags="tags"
        :data-type="dataType"
        :sync-content-loading="syncContentLoading"
        @sync-content="$emit('syncContent')"
        @save-to-notes="$emit('saveToNotes')"
        @print="$emit('print')"
        @decrease-font-size="$emit('decreaseFontSize')"
        @increase-font-size="$emit('increaseFontSize')"
        @reset-font-size="$emit('resetFontSize')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import type { IFeedEntryDetail, ITag } from '@/lib/interfaces'

interface Props {
  entry: IFeedEntryDetail
  dataType: string
  tags: ITag[]
  syncContentLoading: boolean
  isPhone?: boolean
}

defineProps<Props>()

defineEmits<{
  viewFeed: [feed: any]
  syncContent: []
  saveToNotes: []
  print: []
  decreaseFontSize: []
  increaseFontSize: []
  resetFontSize: []
  close: []
}>()




</script>

<style lang="scss" scoped>
.top-app-bar .title {
  align-items: center;
  font-weight: normal;
  display: flex;
  .tags {
    margin-inline-start: 8px;
  }
}

.action-buttons-row {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
}
</style>