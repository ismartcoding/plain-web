<template>
  <div class="container">
    <h2 class="title">{{ entry?.title }}</h2>
    <div class="subtitle v-center">
      <field-id class="time" v-if="entry?.publishedAt" :id="formatDateTime(entry?.publishedAt)" :raw="entry" />
      <span class="author" v-if="entry?.author">{{ entry?.author }}</span>
      <span v-for="tag in entry?.tags" :key="tag.id" class="badge">{{ tag.name }}</span>
      <button
        class="icon-button"
        v-tooltip="$t('add_to_tags')"
        @click.prevent="addToTags"
        style="margin-inline-start: 8px"
      >
        <md-ripple />
        <i-material-symbols:label-outline-rounded />
      </button>
      <md-circular-progress indeterminate class="spinner-sm" v-if="syncContentLoading" />
      <button
        class="icon-button btn-icon"
        v-else
        :disabled="syncContentLoading"
        v-tooltip="$t('sync_content')"
        @click.prevent="syncContent"
      >
        <md-ripple />
        <i-material-symbols:sync-rounded />
      </button>
      <a :href="entry?.url" target="_blank" v-tooltip="$t('view_original_article')">
        <button class="icon-button">
          <md-ripple />
          <i-material-symbols:open-in-new-rounded />
        </button>
      </a>
    </div>
    <div class="md-container" v-html="markdown"></div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { onActivated, onDeactivated, ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { feedEntryGQL, initQuery, tagsGQL } from '@/lib/api/query'
import type { IFeedEntry, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, ITag } from '@/lib/interfaces'
import { useMarkdown } from './hooks/markdown'
import { formatDateTime } from '@/lib/format'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import emitter from '@/plugins/eventbus'
import { initMutation, syncFeedContentGQL } from '@/lib/api/mutation'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'

const { t } = useI18n()

const dataType = 'FEED_ENTRY'
const route = useRoute()
const id = ref(route.params.id)
const entry = ref<IFeedEntry>()
const markdown = ref('')
const tags = ref<ITag[]>()
const { app, urlTokenKey } = storeToRefs(useTempStore())

const { render } = useMarkdown(app, urlTokenKey)
const { refetch } = initQuery({
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

onActivated(() => {
  emitter.on('item_tags_updated', itemTagsUpdatedHandler)
  emitter.on('items_tags_updated', itemsTagsUpdatedHandler)
})

onDeactivated(() => {
  emitter.off('item_tags_updated', itemTagsUpdatedHandler)
  emitter.off('items_tags_updated', itemsTagsUpdatedHandler)
})
</script>
<style lang="scss" scoped>
h2.title {
  font-size: 2rem;
  margin-block-start: 0;
}

.subtitle {
  margin-bottom: 16px;

  .time {
    margin-inline-end: 16px;
  }

  .author {
    margin-inline-end: 8px;
  }

  .author {
    font-weight: 600;
  }
}
</style>
