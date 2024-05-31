<template>
  <div class="content">
    <h2 class="title">
      <field-id v-if="entry" :id="entry?.title" :raw="entry" />
    </h2>
    <div class="subtitle v-center" v-if="entry">
      <a v-if="entry.feed" @click.stop.prevent="viewFeed(entry.feed)">{{ entry.feed.name }}</a
      ><span>&nbsp;&nbsp;·&nbsp;&nbsp;</span>
      <span v-tooltip="formatDateTime(entry.publishedAt)">
        {{ formatTimeAgo(entry.publishedAt) }}
      </span>
      <item-tags :tags="entry?.tags" :type="dataType" />
      <button class="icon-button" v-tooltip="$t('add_to_tags')" @click.prevent="addToTags" style="margin-inline-start: 8px">
        <md-ripple />
        <i-material-symbols:label-outline-rounded />
      </button>
      <md-circular-progress indeterminate class="spinner-sm" v-if="syncContentLoading" />
      <button class="icon-button btn-icon" v-else :disabled="syncContentLoading" v-tooltip="$t('sync_content')" @click.prevent="syncContent">
        <md-ripple />
        <i-material-symbols:sync-rounded />
      </button>
      <a :href="entry?.url" class="icon-button" target="_blank" v-tooltip="$t('view_original_article')">
        <button class="icon-button">
          <md-ripple />
          <i-material-symbols:open-in-new-rounded />
        </button>
      </a>
      <button class="icon-button" v-tooltip="$t('print')" @click.prevent="print">
        <md-ripple />
        <i-material-symbols:print-outline-rounded />
      </button>
    </div>
    <div class="md-container" v-html="markdown"></div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { onActivated, onMounted, onUnmounted, ref } from 'vue'
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

const { t } = useI18n()

const dataType = 'FEED_ENTRY'
const route = useRoute()
const id = ref(route.params.id)
const entry = ref<IFeedEntryDetail>()
const markdown = ref('')
const tags = ref<ITag[]>()
const { app, urlTokenKey } = storeToRefs(useTempStore())

const { render } = useMarkdown(app, urlTokenKey)
const isInitialized = ref(false)
const { load, refetch } = initLazyQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      entry.value = data.feedEntry
      markdown.value = await render(data.feedEntry.content || data.feedEntry.description)
    }
    isInitialized.value = true
  },
  document: feedEntryGQL,
  variables: () => ({
    id: id.value,
  }),
  appApi: true,
})

const mainStore = useMainStore()

const { viewFeed } = useFeeds(mainStore)

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
})

onUnmounted(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
})

onActivated(() => {
  if (isInitialized.value) {
    refetch()
  } else {
    load()
  }
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
    padding: 16px 16px 16px 8px;
    overflow-y: auto;
    width: 0px; // fix flexbox overflow
  }
}
</style>
<style lang="scss" scoped>
h2.title {
  font-size: 1.5rem;
  margin-block-start: 8px;
  margin-block-end: 16px;
  padding: 0;
}

.subtitle {
  margin-bottom: 16px;

  .time {
    margin-inline-end: 16px;
  }

  .tags {
    margin-inline-start: 16px;
  }
}
</style>
