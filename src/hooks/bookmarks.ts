import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMainStore } from '@/stores/main'
import { useBookmarksStore, type Bookmark, type BookmarkGroup } from '@/stores/bookmarks'
import { initLazyQuery, bookmarksGQL } from '@/lib/api/query'
import { initMutation, updateCache, deleteCache } from '@/lib/api/mutation'
import {
  addBookmarksGQL,
  updateBookmarkGQL,
  deleteBookmarksGQL,
  recordBookmarkClickGQL,
  createBookmarkGroupGQL,
  updateBookmarkGroupGQL,
  deleteBookmarkGroupGQL,
} from '@/lib/api/mutation'
import { openModal } from '@/components/modal/methods'
import EditValueModal from '@/components/EditValueModal.vue'
import emitter from '@/plugins/eventbus'
import { exportBookmarksHtml, importBookmarksHtml } from '@/lib/bookmarks-format'

export function useBookmarkOperations() {
  const bmStore = useBookmarksStore()
  const { t } = useI18n()

  const loading = ref(true)

  // Mutations
  const { mutate: mutateRecordClick } = initMutation({ document: recordBookmarkClickGQL })
  const { mutate: mutateAddBookmarks } = initMutation({
    document: addBookmarksGQL,
    options: {
      update(cache: any, res: any) {
        if (res.data?.addBookmarks?.length) {
          const q: any = cache.readQuery({ query: bookmarksGQL })
          if (q) {
            cache.writeQuery({
              query: bookmarksGQL,
              data: { ...q, bookmarks: q.bookmarks.concat(res.data.addBookmarks) },
            })
          }
        }
      },
    },
  })
  const { mutate: mutateUpdateBookmark } = initMutation({
    document: updateBookmarkGQL,
    options: {
      update(cache: any, res: any) {
        if (res.data?.updateBookmark) {
          updateCache(cache, res.data.updateBookmark, bookmarksGQL, 'bookmarks')
        }
      },
    },
  })
  const { mutate: mutateDeleteBookmarks } = initMutation({
    document: deleteBookmarksGQL,
    options: {
      update(cache: any, _res: any, { variables }: any) {
        if (variables?.ids) {
          deleteCache(cache, variables.ids, bookmarksGQL, 'bookmarks')
        }
      },
    },
  })
  const { mutate: mutateUpdateGroup } = initMutation({
    document: updateBookmarkGroupGQL,
    options: {
      update(cache: any, res: any) {
        if (res.data?.updateBookmarkGroup) {
          updateCache(cache, res.data.updateBookmarkGroup, bookmarksGQL, 'bookmarkGroups')
        }
      },
    },
  })
  const { mutate: mutateDeleteGroup } = initMutation({
    document: deleteBookmarkGroupGQL,
    options: {
      update(cache: any, _res: any, { variables }: any) {
        if (variables?.id) {
          deleteCache(cache, variables.id, bookmarksGQL, 'bookmarkGroups')
        }
      },
    },
  })

  // Query
  const { fetch: fetchBookmarks, refetch: refetchBookmarks } = initLazyQuery({
    handle(data: any, error: string) {
      loading.value = false
      if (!error && data) {
        bmStore.setData(data.bookmarks ?? [], data.bookmarkGroups ?? [])
      }
    },
    document: bookmarksGQL,
  })

  // Computed
  const pinnedBookmarks = computed(() => bmStore.sortedBookmarks.filter((b) => b.pinned))
  const nonPinnedUngrouped = computed(() => bmStore.ungroupedBookmarks.filter((b) => !b.pinned))
  function nonPinnedBookmarks(groupId: string) {
    return bmStore.bookmarksByGroupId(groupId).filter((b) => !b.pinned)
  }

  // Actions
  function openBookmark(b: Bookmark) {
    window.open(b.url, '_blank')
    mutateRecordClick({ id: b.id })
  }

  async function togglePin(b: Bookmark) {
    const r = await mutateUpdateBookmark({
      id: b.id,
      input: { title: b.title, url: b.url, groupId: b.groupId, pinned: !b.pinned, sortOrder: b.sortOrder },
    })
    if (r?.data?.updateBookmark) bmStore.updateBookmark({ ...r.data.updateBookmark })
  }

  async function deleteBookmark(id: string) {
    const r = await mutateDeleteBookmarks({ ids: [id] })
    if (r?.data) bmStore.deleteBookmarks([id])
  }

  async function clearAllBookmarks() {
    const ids = bmStore.bookmarks.map((b) => b.id)
    if (!ids.length) return
    const r = await mutateDeleteBookmarks({ ids })
    if (r?.data) bmStore.deleteBookmarks(ids)
  }

  async function clearGroupBookmarks(groupId: string) {
    const ids = bmStore.bookmarksByGroupId(groupId).map((b) => b.id)
    if (!ids.length) return
    const r = await mutateDeleteBookmarks({ ids })
    if (r?.data) bmStore.deleteBookmarks(ids)
  }

  function toggleGroup(group: BookmarkGroup) {
    bmStore.toggleGroupCollapsed(group.id)
    mutateUpdateGroup({ id: group.id, name: group.name, collapsed: group.collapsed, sortOrder: group.sortOrder })
  }

  function startEditGroup(group: BookmarkGroup) {
    openModal(EditValueModal, {
      title: t('edit_group'),
      placeholder: t('name'),
      value: group.name,
      mutation: () => initMutation({ document: updateBookmarkGroupGQL }),
      getVariables: (value: string) => ({
        id: group.id, name: value, collapsed: group.collapsed, sortOrder: group.sortOrder,
      }),
      done: (value: string) => {
        bmStore.updateGroup({ id: group.id, name: value, collapsed: group.collapsed, sortOrder: group.sortOrder })
      },
    })
  }

  function openAddGroupDialog() {
    openModal(EditValueModal, {
      title: t('add_bookmark_group'),
      placeholder: t('name'),
      mutation: () => initMutation({ document: createBookmarkGroupGQL }),
      getVariables: (value: string) => ({ name: value }),
      done: () => reloadBookmarks(),
    })
  }

  async function deleteGroup(id: string) {
    const r = await mutateDeleteGroup({ id })
    if (r?.data) bmStore.deleteGroup(id)
  }

  function reloadBookmarks() {
    loading.value = true
    refetchBookmarks()
  }

  function doExport() {
    exportBookmarksHtml(bmStore.bookmarks, bmStore.sortedGroups)
  }

  function doImport() {
    importBookmarksHtml({
      addBookmarks: async (urls, groupId) => {
        const r = await mutateAddBookmarks({ urls, groupId })
        const added = r?.data?.addBookmarks?.map((b: any) => ({ ...b })) ?? []
        if (added.length) bmStore.addBookmarks(added)
        return added
      },
      findGroupByName: (name) => bmStore.groups.find((g) => g.name === name),
    })
  }

  // Lifecycle
  function onWsBookmarkUpdated(items: Bookmark[]) {
    items.forEach((b) => bmStore.updateBookmark({ ...b }))
  }

  onMounted(() => {
    loading.value = true
    fetchBookmarks()
    emitter.on('bookmark_updated', onWsBookmarkUpdated)
  })

  onUnmounted(() => {
    emitter.off('bookmark_updated', onWsBookmarkUpdated)
  })

  return {
    loading,
    pinnedBookmarks,
    nonPinnedUngrouped,
    nonPinnedBookmarks,
    openBookmark,
    togglePin,
    deleteBookmark,
    clearAllBookmarks,
    clearGroupBookmarks,
    toggleGroup,
    startEditGroup,
    openAddGroupDialog,
    deleteGroup,
    doExport,
    doImport,
  }
}
