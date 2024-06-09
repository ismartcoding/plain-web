<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.feeds') }}
    </template>
    <template #actions>
      <button class="btn-icon" id="add-feed-ref" @click="() => (addMenuVisible = true)" v-tooltip="t('add_subscription')">
        <md-ripple />
        <i-material-symbols:add-rounded />
      </button>
      <md-menu anchor="add-feed-ref" positioning="fixed" stay-open-on-focusout quick :open="addMenuVisible" @closed="() => (addMenuVisible = false)">
        <md-menu-item v-for="item in actionItems" :key="item.text" @click="item.click">
          <div slot="headline">{{ $t(item.text) }}</div>
        </md-menu-item>
      </md-menu>
    </template>
    <template #body>
      <ul class="nav">
        <li @click.prevent="viewAll" :class="{ active: !today && !selectedTagId && !selectedFeedId }">
          <span class="title">{{ $t('all') }}</span>
          <span class="count" v-if="counter.feedEntries >= 0">{{ counter.feedEntries.toLocaleString() }}</span>
        </li>
        <li @click.prevent="viewToday" :class="{ active: today }">
          <span class="title">{{ $t('today') }}</span>
          <span class="count" v-if="counter.feedEntriesToday >= 0">{{ counter.feedEntriesToday.toLocaleString() }}</span>
        </li>
        <li
          v-for="item in feeds"
          :key="item.id"
          @click.stop.prevent="viewFeed(item)"
          :class="{
            active: selectedFeedId && item.id === selectedFeedId,
          }"
        >
          <span class="title">{{ item.name }}</span>
          <button :id="'feed-' + item.id" class="btn-icon sm" @click.prevent.stop="showFeedMenu(item)" v-tooltip="$t('actions')">
            <md-ripple />
            <i-material-symbols:more-vert />
          </button>
          <span class="count" v-if="getFeedCount(item.id) >= 0">{{ getFeedCount(item.id).toLocaleString() }}</span>
        </li>
      </ul>
      <md-menu positioning="popover" :anchor="'feed-' + selectedFeed?.id" stay-open-on-focusout quick :open="feedMenuVisible" @closed="feedMenuVisible = false">
        <md-menu-item @click="editFeed(selectedFeed!)">
          <div slot="headline">{{ $t('edit') }}</div>
        </md-menu-item>
        <md-menu-item @click="deleteFeed(selectedFeed!)">
          <div slot="headline">{{ $t('delete') }}</div>
        </md-menu-item>
      </md-menu>
      <tag-filter type="FEED_ENTRY" :selected="selectedTagId" />
      <input ref="fileInput" style="display: none" accept=".xml" type="file" @change="uploadChanged" />
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import type { IDropdownItem, IFeed, IFeedCount, IFilter } from '@/lib/interfaces'
import { reactive, ref, watch } from 'vue'
import AddFeedModal from '@/components/AddFeedModal.vue'
import { deleteFeedGQL, exportFeedsGQL, importFeedsGQL, initMutation } from '@/lib/api/mutation'
import { downloadFromString } from '@/lib/api/file'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { openModal } from '@/components/modal'
import { initQuery, feedsGQL, initLazyQuery, feedEntryCountGQL } from '@/lib/api/query'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import FeedModal from './FeedModal.vue'
import { useFeeds } from '@/hooks/feeds'
import { decodeBase64 } from '@/lib/strutil'
import { useSearch } from '@/hooks/search'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'

const { t } = useI18n()
const mainStore = useMainStore()
const { counter } = storeToRefs(useTempStore())
const { parseQ } = useSearch()
const filter = reactive<IFilter>({
  tagIds: [],
})
const feeds = ref<IFeed[]>([])
const actionItems: IDropdownItem[] = [
  { text: 'add_subscription', click: add },
  { text: 'import_opml_file', click: importFile },
  { text: 'export_opml_file', click: exportFile },
]
const addMenuVisible = ref(false)
const selectedTagId = ref('')
const selectedFeedId = ref('')
const today = ref(false)
const fileInput = ref<HTMLInputElement>()
const feedsCount = ref<Map<string, number>>(new Map())
const feedMenuVisible = ref(false)
const selectedFeed = ref<IFeed>()

const { fetch } = initLazyQuery({
  handle: (data: { total: number; today: number; feedsCount: IFeedCount[] }) => {
    if (data) {
      counter.value.feedEntries = data.total
      counter.value.feedEntriesToday = data.today
      data.feedsCount.forEach((item: IFeedCount) => {
        feedsCount.value.set(item.id, item.count)
      })
    }
  },
  document: feedEntryCountGQL,
  variables: () => ({}),
  appApi: true,
})

function getFeedCount(id: string) {
  return feedsCount.value.get(id) ?? -1
}

function updateActive() {
  const route = router.currentRoute.value
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  selectedTagId.value = filter.tagIds.length === 1 ? filter.tagIds[0] : ''
  selectedFeedId.value = filter.feedId ?? ''
  today.value = filter.today ?? false
  if (today.value) {
    selectedTagId.value = ''
    selectedFeedId.value = ''
  } else if (selectedTagId.value && selectedFeedId.value) {
    selectedTagId.value = ''
  }
  fetch()
}

updateActive()

watch(
  () => router.currentRoute.value,
  () => {
    updateActive()
  }
)

const { viewFeed, viewAll, viewToday } = useFeeds(mainStore)

const { refetch } = initQuery({
  handle: (data: { feeds: IFeed[] }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        feeds.value = data.feeds
      }
    }
  },
  document: feedsGQL,
  appApi: true,
})

function uploadChanged(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) {
    return
  }
  const reader = new FileReader()
  reader.addEventListener(
    'load',
    () => {
      importOPML({ content: reader.result })
    },
    false
  )
  reader.readAsText(files[0])
}

function add() {
  openModal(AddFeedModal, {
    done: () => {
      refetch()
    },
  })
}

const { mutate: exportOPML, onDone: onExpored } = initMutation({
  document: exportFeedsGQL,
  appApi: true,
})

onExpored((r: any) => {
  downloadFromString(r.data.exportFeeds, 'application/xml', 'feeds.xml')
})

const { mutate: importOPML, onDone: onImported } = initMutation({
  document: importFeedsGQL,
  appApi: true,
})

onImported(() => {
  toast(t('imported'))
  refetch()
})

function importFile() {
  fileInput.value!.value = ''
  fileInput.value!.click()
}

function exportFile() {
  exportOPML()
}

function showFeedMenu(item: IFeed) {
  selectedFeed.value = item
  feedMenuVisible.value = true
}

function editFeed(item: IFeed) {
  openModal(FeedModal, {
    data: item,
  })
}

function deleteFeed(item: IFeed) {
  openModal(DeleteConfirm, {
    id: item.id,
    name: item.name,
    gql: deleteFeedGQL,
    appApi: true,
    typeName: 'Feed',
    done: () => {
      replacePath(mainStore, `/feeds`)
    },
  })
}
</script>
