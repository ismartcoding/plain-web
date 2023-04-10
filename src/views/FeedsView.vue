<template>
  <div class="v-toolbar">
    <breadcrumb :current="() => `${$t('page_title.feeds')} (${total})`" />
    <div class="right-actions">
      <button class="btn btn-action" :disabled="syncing" type="button" @click.prevent="syncFeeds">
        {{ syncing ? $t('syncing') : $t('sync_feeds') }}
      </button>
      <dropdown :title="$t('actions')" :items="actionItems" />
      <search-input v-model="q" :search="doSearch">
        <template #filters>
          <div class="row mb-3">
            <label class="col-md-3 col-form-label">{{ $t('keywords') }}</label>
            <div class="col-md-9">
              <input type="text" v-model="filter.text" class="form-control" @keyup.enter="applyAndDoSearch" />
            </div>
          </div>
          <div class="row mb-3">
            <label class="col-md-3 col-form-label">{{ $t('tags') }}</label>
            <div class="col-md-9">
              <multiselect v-model="filter.tags" label="name" track-by="id" :options="tags" />
            </div>
          </div>
          <div class="actions">
            <button type="button" class="btn" @click.stop="applyAndDoSearch">
              {{ $t('search') }}
            </button>
          </div>
        </template>
      </search-input>
    </div>
  </div>
  <table class="table">
    <thead>
      <tr>
        <th><input class="form-check-input" type="checkbox" @change="toggleSelect" v-model="selectAll" /></th>
        <th>ID</th>
        <th></th>
        <th>{{ $t('title') }}</th>
        <th>{{ $t('source') }}</th>
        <th>{{ $t('tags') }}</th>
        <th>{{ $t('published_at') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="item in items"
        :key="item.id"
        :class="{ checked: item.checked }"
        @click.stop="item.checked = !item.checked"
      >
        <td><input class="form-check-input" type="checkbox" v-model="item.checked" /></td>
        <td><field-id :id="item.id" :raw="item" /></td>
        <td>
          <img v-if="item.image" :src="getFileUrl(item.image) + '&w=200&h=200'" width="50" height="50" />
        </td>
        <td>
          <a :href="viewUrl(item)" @click.prevent="view(item)">{{ item.title || $t('no_content') }}</a>
        </td>
        <td>{{ item.author }}</td>
        <td>
          <span v-for="tag in item.tags" class="badge">{{ tag.name }}</span>
        </td>
        <td class="nowrap" :title="formatDateTimeFull(item.publishedAt)">
          {{ formatDateTime(item.publishedAt) }}
        </td>
      </tr>
    </tbody>
    <tfoot v-if="!items.length">
      <tr>
        <td colspan="7">
          <div class="no-data-placeholder">
            {{ $t(noDataKey(loading)) }}
          </div>
        </td>
      </tr>
    </tfoot>
  </table>
  <v-pagination v-if="total > limit" v-model="page" :total="total" :limit="limit" />
</template>

<script setup lang="ts">
import { getFileUrl } from '@/lib/api/file'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import toast from '@/components/toaster'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { initQuery, feedsTagsGQL, initLazyQuery, feedEntriesGQL } from '@/lib/api/query'
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import type { ITag, IDropdownItem, IFeedEntryItem, IFeedEntry, IFeed, IFeedEntryFilter } from '@/lib/interfaces'
import { buildFilterQuery, buildQuery, parseQuery } from '@/lib/search'
import { kebabCase } from 'lodash-es'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { noDataKey } from '@/lib/list'
import { useDelete, useSelectable } from './hooks/list'
import emitter from '@/plugins/eventbus'
import { useAddToTags, useRemoveFromTags } from './hooks/tags'
import { deleteFeedEntriesGQL, initMutation, syncFeedsGQL } from '@/lib/api/mutation'

const mainStore = useMainStore()
const items = ref<IFeedEntryItem[]>([])
const { t } = useI18n()
const filter: IFeedEntryFilter = reactive({
  text: '',
  feeds: [],
  tags: [],
})

const tagType = 'FEED_ENTRY'
const route = useRoute()
const query = route.query
const page = ref(parseInt(query.page?.toString() ?? '1'))
const limit = 50
const total = ref(0)
const tags = ref<ITag[]>([])
const feeds = ref<IFeed[]>([])
const q = ref(decodeBase64(query.q?.toString() ?? ''))
const finalQ = ref('')
const { addToTags } = useAddToTags(tagType, items, tags)
const { removeFromTags } = useRemoveFromTags(tagType, items, tags)
const { deleteItems } = useDelete(
  deleteFeedEntriesGQL,
  () => {
    refetch()
  },
  items
)
const syncing = ref(false)

const actionItems: IDropdownItem[] = [
  { text: t('add_to_tags'), click: addToTags },
  { text: t('remove_from_tags'), click: removeFromTags },
  { text: t('delete'), click: deleteItems },
]

const { selectAll, toggleSelect } = useSelectable(items)
const { loading, load, refetch } = initLazyQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        items.value = data.feedEntries.map((it: IFeedEntry) => ({ ...it, checked: false }))
        total.value = data.feedEntryCount
      }
    }
  },
  document: feedEntriesGQL,
  variables: () => ({
    offset: (page.value - 1) * limit,
    limit,
    query: finalQ.value,
  }),
  appApi: true,
})

initQuery({
  handle: async (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        tags.value = data.tags
        feeds.value = data.feeds
        const fields = parseQuery(q.value as string)
        filter.tags = []
        const tagIds: string[] = []
        const feedIds: string[] = []
        fields.forEach((it) => {
          if (it.name === 'text') {
            filter.text = it.value
          } else if (it.name === 'tag') {
            const tag = data.tags.find((t: ITag) => kebabCase(t.name) === it.value)
            if (tag) {
              filter.tags.push(tag)
              tagIds.push(tag.id)
            } else {
              tagIds.push('invalid')
            }
          } else if (it.name === 'feed') {
            const feed = data.feeds.find((t: IFeed) => kebabCase(t.name) === it.value)
            if (feed) {
              filter.feeds.push(feed)
              feedIds.push(feed.id)
            } else {
              feedIds.push('invalid')
            }
          }
        })
        const newFields = [...fields].filter((it) => it.name !== 'tag' && it.name !== 'feed')
        tagIds.forEach((it) => {
          newFields.push({
            name: 'tag_id',
            op: '',
            value: it,
          })
        })

        feedIds.forEach((it) => {
          newFields.push({
            name: 'feed_id',
            op: '',
            value: it,
          })
        })

        finalQ.value = buildQuery(newFields)
        await nextTick()
        load()
      }
    }
  },
  document: feedsTagsGQL,
  variables: {
    type: tagType,
  },
  appApi: true,
})

watch(page, (value: number) => {
  replacePath(mainStore, `/feeds?page=${value}&q=${encodeBase64(q.value)}`)
})

function applyAndDoSearch() {
  q.value = buildFilterQuery(filter)
  doSearch()
}

function doSearch() {
  replacePath(mainStore, `/feeds?q=${encodeBase64(q.value)}`)
}

onMounted(() => {
  emitter.on('refetch_by_tag_type', (type: string) => {
    if (type === tagType) {
      refetch()
    }
  })

  emitter.on('feeds_fetched', (data: any) => {
    syncing.value = false
    toast(data.error || t('feeds_synced'))
  })
})

function view(item: IFeedEntry) {
  router.push(viewUrl(item))
}

function viewUrl(item: IFeedEntry) {
  return `/feeds/${item.feedId}/entries/${item.id}`
}

const { mutate: doSyncFeeds } = initMutation({
  document: syncFeedsGQL,
  appApi: true,
})

function syncFeeds() {
  syncing.value = true
  doSyncFeeds({ id: '' })
}
</script>
