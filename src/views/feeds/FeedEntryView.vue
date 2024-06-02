<template>
  <div v-if="loading" class="content-loading">
    <md-circular-progress indeterminate />
  </div>
  <article v-else class="content">
    <div class="top-app-bar">
      <div class="title" v-if="entry">
        <a v-if="entry.feed" @click.stop.prevent="viewFeed(entry.feed)">{{ entry.feed.name }}</a
        ><span>&nbsp;&nbsp;·&nbsp;&nbsp;</span>
        <time v-tooltip="formatDateTime(entry.publishedAt)">
          {{ formatTimeAgo(entry.publishedAt) }}
        </time>
        <item-tags :tags="entry?.tags" :type="dataType" />
        <button class="btn-icon sm" v-tooltip="$t('add_to_tags')" @click.prevent="addToTags" style="margin-inline-start: 16px">
          <md-ripple />
          <i-material-symbols:label-outline-rounded />
        </button>
        <md-circular-progress indeterminate class="spinner-sm" v-if="syncContentLoading" />
        <button class="btn-icon sm" v-else :disabled="syncContentLoading" v-tooltip="$t('sync_content')" @click.prevent="syncContent">
          <md-ripple />
          <i-material-symbols:sync-rounded />
        </button>
        <a :href="entry?.url" class="btn-icon" target="_blank" v-tooltip="$t('view_original_article')">
          <button class="btn-icon sm">
            <md-ripple />
            <i-material-symbols:open-in-new-rounded />
          </button>
        </a>
        <button class="btn-icon sm" v-tooltip="$t('print')" @click.prevent="print">
          <md-ripple />
          <i-material-symbols:print-outline-rounded />
        </button>
      </div>

      <div class="actions">
        <button class="btn-icon" v-tooltip="$t('close')" @click.prevent="backToList">
          <md-ripple />
          <i-material-symbols:close-rounded />
        </button>
      </div>
    </div>
    <div class="article-title">
      {{ entry?.title }}
    </div>
    <div class="md-container" v-html="markdown"></div>
  </article>
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
import { initMutation, syncFeedContentGQL } from '@/lib/api/mutation'
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
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      entry.value = data.feedEntry
      markdown.value = await render(data.feedEntry.content || data.feedEntry.description)
    }
  },
  document: feedEntryGQL,
  variables: () => ({
    id: id.value,
  }),
  appApi: true,
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

initQuery({
  handle: (data: any, error: string) => {
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
  appApi: true,
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
  appApi: true,
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
.main-feed-entry {
  display: flex;

  .sidebar2 {
    width: 400px;
  }
  .content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    width: 0px; // fix flexbox overflow
    padding: 0 16px;
    .top-app-bar {
      padding-inline: 0;
    }
  }
}
</style>
<style lang="scss" scoped>
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
