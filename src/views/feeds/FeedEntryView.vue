<!-- eslint-disable vue/no-v-html -->
<template>
  <div class="content">
    <article v-if="loading && !entry">
      <div class="top-app-bar">
        <div class="title">
          <div class="skeleton-text lg" style="width: 40%"></div>
        </div>
        <div class="actions">
          <div class="skeleton-image sm"></div>
        </div>
      </div>
      <div class="article-title">
        <div class="skeleton-text lg" style="width: 60%"></div>
      </div>
      <div class="md-container md-skeleton-container">
        <div class="skeleton-text" style="width: 100%"></div>
        <div class="skeleton-text" style="width: 90%"></div>
        <div class="skeleton-text" style="width: 75%"></div>
        <div class="skeleton-text" style="width: 85%"></div>
        <div class="skeleton-text" style="width: 60%"></div>
        <div class="skeleton-text" style="width: 80%"></div>
        <div class="skeleton-text" style="width: 70%"></div>
        <div class="skeleton-text" style="width: 65%"></div>
      </div>
    </article>
    <article v-else-if="entry">
      <div class="top-app-bar">
        <div class="title">
          <a v-if="entry.feed" @click.stop.prevent="viewFeed(entry.feed)">{{ entry.feed.name }}</a>
          <time v-if="entry" v-tooltip="formatDateTime(entry.publishedAt)">
            {{ formatTimeAgo(entry.publishedAt) }}
          </time>
          <item-tags :tags="entry?.tags" :type="dataType" />
          <button v-tooltip="$t('add_to_tags')" class="btn-icon sm" style="margin-inline-start: 16px" @click.prevent="addToTags">
            
            <i-material-symbols:label-outline-rounded />
          </button>
          <v-circular-progress v-if="syncContentLoading" indeterminate class="sm" />
          <button v-else v-tooltip="$t('sync_content')" class="btn-icon sm" :disabled="syncContentLoading" @click.prevent="syncContent">
            
            <i-material-symbols:sync-rounded />
          </button>
          <a v-tooltip="$t('view_original_article')" :href="entry?.url" class="btn-icon" target="_blank">
            <button class="btn-icon sm">
              
              <i-material-symbols:open-in-new-rounded />
            </button>
          </a>
          <button v-tooltip="$t('save_to_notes')" class="btn-icon sm" @click.prevent="saveToNotes({ query: `ids:${id}` })">
            
            <i-material-symbols:add-notes-outline-rounded />
          </button>
          <button v-tooltip="$t('print')" class="btn-icon sm" @click.prevent="print">
            
            <i-material-symbols:print-outline-rounded />
          </button>
        </div>
        <div class="actions">
          <button v-tooltip="$t('close')" class="btn-icon" @click.prevent="backToList">
            
            <i-material-symbols:close-rounded />
          </button>
        </div>
      </div>
      <div class="article-title">
        {{ entry?.title }}
      </div>
      <div class="md-container" v-html="markdown"></div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { onActivated, onDeactivated, ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { feedEntryGQL, initLazyQuery, initQuery, tagsGQL } from '@/lib/api/query'
import type { IFeedEntryDetail, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, ITag } from '@/lib/interfaces'
import { useMarkdown } from '@/hooks/markdown'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
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
.md-skeleton-container {
  .skeleton-text {
    margin-block-end: 8px;
  }
}

.top-app-bar .title {
  align-items: center;
  font-weight: normal;
  display: flex;
  .tags {
    margin-inline-start: 8px;
  }
}
.article-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 16px;
}
</style>
