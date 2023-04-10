<template>
  <div class="container">
    <h2 class="title">{{ entry?.title }}</h2>
    <div class="subtitle">
      <field-id class="time" v-if="entry?.publishedAt" :id="formatDateTime(entry?.publishedAt)" :raw="entry" />
      <span class="author" v-if="entry?.author">{{ entry?.author }}</span>
      <button class="btn-icon" :title="$t('add_to_tags')" @click.prevent="addToTags">
        <i-material-symbols:tag-rounded class="bi" />
      </button>

      <button class="btn-icon" :disabled="syncContentLoading" :title="$t('sync_content')" @click.prevent="syncContent">
        <i class="spinner spinner-sm" v-if="syncContentLoading"></i>
        <i-material-symbols:sync-rounded v-else class="bi" />
      </button>
      <a :href="entry?.url" target="_blank" class="btn-icon" :title="$t('view_original_article')">
        <i-material-symbols:open-in-new-rounded class="bi" />
      </a>
    </div>
    <div class="md-container" v-html="markdown"></div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { onMounted, ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { feedEntryGQL, initQuery, tagsGQL } from '@/lib/api/query'
import type { IFeedEntry, ITag } from '@/lib/interfaces'
import { useMarkdown } from './hooks/markdown'
import { formatDateTime } from '@/lib/format'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import emitter from '@/plugins/eventbus'
import { initMutation, syncFeedContentGQL } from '@/lib/api/mutation'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'

const { t } = useI18n()

const tagType = 'FEED_ENTRY'
const route = useRoute()
const id = ref(route.params.id)
const entry = ref<IFeedEntry>()
const markdown = ref('')
const tags = ref<ITag[]>()
const { app } = storeToRefs(useTempStore())

const { render } = useMarkdown(app)
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
    type: tagType,
  },
  appApi: true,
})

function addToTags() {
  openModal(UpdateTagRelationsModal, {
    tagType,
    tags: tags.value,
    item: {
      key: entry.value?.id,
      title: entry.value?.title,
      size: 0,
    },
    selected: entry.value?.tags,
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

onMounted(() => {
  emitter.on('refetch_by_tag_type', (type: string) => {
    if (type === tagType) {
      refetch()
    }
  })
})
</script>
<style lang="scss" scoped>
h2.title {
  font-size: 2rem;

  a:hover {
    text-decoration: none;
  }
}

.subtitle {
  margin-bottom: 16px;

  .time,
  .author {
    margin-right: 16px;
  }

  .author {
    font-weight: 600;
  }
}
</style>
