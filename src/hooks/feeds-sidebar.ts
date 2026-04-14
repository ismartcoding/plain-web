import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import type { IDropdownItem, IFeed, IFeedCount, IFilter } from '@/lib/interfaces'
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import AddFeedModal from '@/components/AddFeedModal.vue'
import { deleteFeedGQL, exportFeedsGQL, importFeedsGQL, initMutation } from '@/lib/api/mutation'
import { downloadFromString } from '@/lib/api/file'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { openModal } from '@/components/modal'
import { initQuery, feedsGQL, initLazyQuery, feedEntryCountGQL } from '@/lib/api/query'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import FeedModal from '@/views/feeds/FeedModal.vue'
import { useFeeds } from '@/hooks/feeds'
import { decodeBase64 } from '@/lib/strutil'
import { useSearch } from '@/hooks/search'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import emitter from '@/plugins/eventbus'

export function useFeedsSidebar() {
  const { t } = useI18n()
  const mainStore = useMainStore()
  const { counter } = storeToRefs(useTempStore())
  const { parseQ } = useSearch()
  const filter = reactive<IFilter>({ tagIds: [] })
  const feeds = ref<IFeed[]>([])
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
        data.feedsCount.forEach((item: IFeedCount) => feedsCount.value.set(item.id, item.count))
      }
    },
    document: feedEntryCountGQL,
    variables: () => ({}),
  })

  function getFeedCount(id: string) { return feedsCount.value.get(id) ?? -1 }

  function updateActive() {
    const route = router.currentRoute.value
    const q = decodeBase64(route.query.q?.toString() ?? '')
    parseQ(filter, q)
    selectedTagId.value = filter.tagIds.length === 1 ? filter.tagIds[0] : ''
    selectedFeedId.value = filter.feedId ?? ''
    today.value = filter.today ?? false
    if (today.value) { selectedTagId.value = ''; selectedFeedId.value = '' }
    else if (selectedTagId.value && selectedFeedId.value) { selectedTagId.value = '' }
    fetch()
  }

  updateActive()
  watch(() => router.currentRoute.value, () => updateActive())

  const { viewFeed, viewAll, viewToday } = useFeeds(mainStore)

  const { refetch } = initQuery({
    handle: (data: { feeds: IFeed[] }, error: string) => {
      if (error) toast(t(error), 'error')
      else if (data) feeds.value = data.feeds
    },
    document: feedsGQL,
  })

  function uploadChanged(e: Event) {
    const files = (e.target as HTMLInputElement).files
    if (!files) return
    const reader = new FileReader()
    reader.addEventListener('load', () => importOPML({ content: reader.result }), false)
    reader.readAsText(files[0])
  }

  function add() { openModal(AddFeedModal, { done: () => refetch() }) }

  const { mutate: exportOPML, onDone: onExported } = initMutation({ document: exportFeedsGQL })
  onExported((r: any) => downloadFromString(r.data.exportFeeds, 'application/xml', 'feeds.xml'))

  const { mutate: importOPML, onDone: onImported } = initMutation({ document: importFeedsGQL })
  onImported(() => { toast(t('imported')); refetch() })

  function importFile() { fileInput.value!.value = ''; fileInput.value!.click() }
  function exportFile() { exportOPML() }

  function showFeedMenu(item: IFeed) {
    selectedFeed.value = item
    const anchorElement = document.getElementById('feed-' + item.id)
    document.dispatchEvent(new CustomEvent('dropdown-toggle', { detail: { exclude: anchorElement } }))
    feedMenuVisible.value = true
  }

  function editFeed(item: IFeed) { openModal(FeedModal, { data: item }) }

  function deleteFeed(item: IFeed) {
    openModal(DeleteConfirm, {
      id: item.id, name: item.name, gql: deleteFeedGQL, typeName: 'Feed',
      done: () => { feeds.value = feeds.value.filter((f) => f.id !== item.id); replacePath(mainStore, `/feeds`) },
    })
  }

  const actionItems: IDropdownItem[] = [
    { text: 'add_subscription', click: add },
    { text: 'import_opml_file', click: importFile },
    { text: 'export_opml_file', click: exportFile },
  ]

  onMounted(() => {
    emitter.on('feed_entries_deleted', fetch)
    emitter.on('feeds_fetched', fetch)
  })
  onUnmounted(() => {
    emitter.off('feed_entries_deleted', fetch)
    emitter.off('feeds_fetched', fetch)
  })

  return {
    counter, feeds, actionItems,
    addMenuVisible, selectedTagId, selectedFeedId, today,
    fileInput, feedMenuVisible, selectedFeed,
    getFeedCount, viewFeed, viewAll, viewToday,
    uploadChanged, showFeedMenu, editFeed, deleteFeed,
  }
}
