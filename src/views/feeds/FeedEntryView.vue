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
        @decrease-font-size="decreaseFontSize"
        @increase-font-size="increaseFontSize"
        @reset-font-size="resetFontSize"
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
import { useRoute } from 'vue-router'
import { onActivated, onDeactivated, ref, inject } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import FeedEntryToolbar from '@/components/feeds/FeedEntryToolbar.vue'
import { feedEntryGQL, initLazyQuery, initQuery, tagsGQL } from '@/lib/api/query'
import type { IFeedEntryDetail, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, ITag } from '@/lib/interfaces'
import { useMarkdown } from '@/hooks/markdown'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import emitter from '@/plugins/eventbus'
import { initMutation, saveFeedEntriesToNotesGQL, syncFeedContentGQL } from '@/lib/api/mutation'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { useMainStore } from '@/stores/main'
import { useFeeds } from '@/hooks/feeds'
import { replacePath } from '@/plugins/router'

const { t } = useI18n()

const isPhone = inject<boolean>('isPhone')
const dataType = 'FEED_ENTRY'
const route = useRoute()
const id = ref(route.params.id)
const entry = ref<IFeedEntryDetail>()
const markdown = ref('')
const tags = ref<ITag[]>()
const { app, urlTokenKey } = storeToRefs(useTempStore())

const { render } = useMarkdown(app, urlTokenKey)
const { loading, fetch } = initLazyQuery({
  handle: async (data: { feedEntry: IFeedEntryDetail }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      entry.value = data.feedEntry
      if (entry.value) {
        markdown.value = await render(data.feedEntry.content || data.feedEntry.description)
      } else {
        markdown.value = ''
      }
    }
  },
  document: feedEntryGQL,
  variables: () => ({
    id: id.value,
  }),
})

const mainStore = useMainStore()

const { viewFeed } = useFeeds(mainStore)

function backToList() {
  const q = route.query.q
  if (q) {
    replacePath(mainStore, `/feeds?q=${q}`)
  } else {
    replacePath(mainStore, `/feeds`)
  }
}

const {
  mutate: saveToNotes,
  loading: saving,
  onDone: onSaveToNotesDone,
} = initMutation({
  document: saveFeedEntriesToNotesGQL,
})

onSaveToNotesDone(() => {
  toast(t('saved'))
})

initQuery({
  handle: (data: { tags: ITag[] }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        tags.value = data.tags
      }
    }
  },
  document: tagsGQL,
  variables: {
    type: dataType,
  },
})

const print = () => {
  window.print()
}

function addToTags() {
  openModal(UpdateTagRelationsModal, {
    type: dataType,
    tags: tags.value,
    item: {
      key: entry.value?.id,
      title: '',
      size: 0,
    },
    selected: tags.value?.filter((it) => entry.value?.tags.some((t) => t.id === it.id)),
  })
}

const {
  mutate: syncFeedContent,
  loading: syncContentLoading,
  onDone: syncContentDone,
} = initMutation({
  document: syncFeedContentGQL,
})

syncContentDone(async (r: any) => {
  const data = r.data
  entry.value = data.syncFeedContent
  markdown.value = await render(data.syncFeedContent.content || data.syncFeedContent.description)
})

const syncContent = () => {
  syncFeedContent({ id: id.value })
}

const itemsTagsUpdatedHandler = (event: IItemsTagsUpdatedEvent) => {
  if (event.type === dataType) {
    fetch()
  }
}

const itemTagsUpdatedHandler = (event: IItemTagsUpdatedEvent) => {
  if (event.type === dataType) {
    fetch()
  }
}

onActivated(() => {
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
  fetch()
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
})

const decreaseFontSize = () => {
  mainStore.decreaseFeedEntryFontSize()
}

const increaseFontSize = () => {
  mainStore.increaseFeedEntryFontSize()
}

const resetFontSize = () => {
  mainStore.resetFeedEntryFontSize()
}

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
