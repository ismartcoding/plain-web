<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.feeds') }}
    </template>
    <template #actions>
      <v-icon-button id="add-feed-ref" v-tooltip="$t('add_subscription')" @click="() => (addMenuVisible = true)">
        <i-material-symbols:add-rounded />
      </v-icon-button>
    </template>
    <template #body>
      <ul class="nav">
        <li :class="{ active: !today && !selectedTagId && !selectedFeedId }" @click.prevent="viewAll">
          <span class="icon" aria-hidden="true"><i-lucide:layout-grid /></span>
          <span class="title">{{ $t('all') }}</span>
          <span v-if="counter.feedEntries >= 0" class="count">{{ counter.feedEntries.toLocaleString() }}</span>
        </li>
        <li :class="{ active: today }" @click.prevent="viewToday">
          <span class="icon" aria-hidden="true"><i-lucide:calendar-days /></span>
          <span class="title">{{ $t('today') }}</span>
          <span v-if="counter.feedEntriesToday >= 0" class="count">{{ counter.feedEntriesToday.toLocaleString() }}</span>
        </li>
        <li
          v-for="item in feeds"
          :key="item.id"
          :class="{
            active: selectedFeedId && item.id === selectedFeedId,
          }"
          @click.stop.prevent="viewFeed(item)"
        >
          <span class="title">{{ item.name }}</span>
          <v-icon-button :id="'feed-' + item.id" v-tooltip="$t('actions')" @click.prevent.stop="showFeedMenu(item)">
            <i-material-symbols:more-vert />
          </v-icon-button>
          <span v-if="getFeedCount(item.id) >= 0" class="count">{{ getFeedCount(item.id).toLocaleString() }}</span>
        </li>
      </ul>
      <v-dropdown-menu v-model="addMenuVisible" anchor="add-feed-ref">
        <div v-for="item in actionItems" :key="item.text" class="dropdown-item" @click="item.click(); addMenuVisible = false">
          {{ $t(item.text) }}
        </div>
      </v-dropdown-menu>
      <v-dropdown-menu v-model="feedMenuVisible" :anchor="'feed-' + selectedFeed?.id">
        <div class="dropdown-item" @click="editFeed(selectedFeed!); feedMenuVisible = false">
          {{ $t('edit') }}
        </div>
        <div class="dropdown-item" @click="deleteFeed(selectedFeed!); feedMenuVisible = false">
          {{ $t('delete') }}
        </div>
      </v-dropdown-menu>
      <tag-filter type="FEED_ENTRY" :selected="selectedTagId" />
      <input ref="fileInput" style="display: none" accept=".xml" type="file" @change="uploadChanged" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { useFeedsSidebar } from '@/hooks/feeds-sidebar'

const {
  counter, feeds, actionItems,
  addMenuVisible, selectedTagId, selectedFeedId, today,
  fileInput, feedMenuVisible, selectedFeed,
  getFeedCount, viewFeed, viewAll, viewToday,
  uploadChanged, showFeedMenu, editFeed, deleteFeed,
} = useFeedsSidebar()
</script>
