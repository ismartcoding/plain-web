import type { IFeedEntry, ITag } from '@/lib/interfaces'
import type { Ref, ComputedRef } from 'vue'
import { openModal } from '@/components/modal'
import DeleteConfirm from '@/components/DeleteConfirm.vue'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { useDelete } from '@/hooks/list'
import { useAddToTags } from '@/hooks/tags'
import { deleteFeedEntriesGQL, initMutation, saveFeedEntriesToNotesGQL, syncFeedsGQL, deleteFeedEntryGQL } from '@/lib/api/mutation'
import { useFeeds } from '@/hooks/feeds'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { DataType } from '@/lib/data'
import router, { replacePath } from '@/plugins/router'
import emitter from '@/plugins/eventbus'

interface UseFeedEntriesActionsOptions {
  selectedIds: Ref<string[]>
  realAllChecked: Ref<boolean>
  q: Ref<string>
  total: Ref<number>
  tags: Ref<ITag[]>
  items: Ref<IFeedEntry[]>
  clearSelection: () => void
  fetch: () => void
}

export function useFeedEntriesActions(opts: UseFeedEntriesActionsOptions) {
  const { selectedIds, realAllChecked, q, total, tags, items, clearSelection, fetch } = opts
  const mainStore = useMainStore()
  const { feedsSyncing } = storeToRefs(useTempStore())
  const { t } = useI18n()
  const dataType = DataType.FEED_ENTRY

  const { addToTags } = useAddToTags(dataType, tags)
  const { viewFeed } = useFeeds(mainStore)

  const { deleteItems } = useDelete(deleteFeedEntriesGQL, () => {
    clearSelection()
    fetch()
    if (items.value.some((it) => it.tags.length)) {
      emitter.emit('refetch_tags', dataType)
    }
    emitter.emit('feed_entries_deleted')
  })

  const { mutate: saveToNotes, loading: savingNotes, onDone: onSaveToNotesDone } = initMutation({
    document: saveFeedEntriesToNotesGQL,
  })

  onSaveToNotesDone(() => { toast(t('saved')) })

  const { mutate: doSyncFeeds } = initMutation({
    document: syncFeedsGQL,
  })

  function saveFeedsToNotes() {
    if (!realAllChecked.value) {
      if (selectedIds.value.length === 0) {
        toast(t('select_first'), 'error')
        return
      }
      saveToNotes({ query: `ids:${selectedIds.value.join(',')}` })
    } else {
      saveToNotes({ query: q.value })
    }
  }

  function syncFeeds() {
    feedsSyncing.value = true
    doSyncFeeds({ id: '' })
  }

  function deleteItem(item: IFeedEntry) {
    openModal(DeleteConfirm, {
      id: item.id,
      name: item.title,
      gql: deleteFeedEntryGQL,
      variables: () => ({ query: `ids:${item.id}` }),
      typeName: 'FeedEntry',
      done: () => {
        items.value = items.value.filter((it) => it.id !== item.id)
        clearSelection()
        total.value--
        if (item.tags.length) emitter.emit('refetch_tags', dataType)
      },
    })
  }

  function addItemToTags(item: IFeedEntry) {
    openModal(UpdateTagRelationsModal, {
      type: dataType,
      tags: tags.value,
      item: { key: item.id, title: '', size: 0 },
      selected: tags.value.filter((it) => item.tags.some((t) => t.id === it.id)),
    })
  }

  function viewUrl(item: IFeedEntry) {
    const qVal = router.currentRoute.value.query.q
    return qVal ? `/feeds/${item.feedId}/entries/${item.id}?q=${qVal}` : `/feeds/${item.feedId}/entries/${item.id}`
  }

  function view(item: IFeedEntry) {
    replacePath(mainStore, viewUrl(item))
  }

  function backToList() {
    const qVal = router.currentRoute.value.query.q
    replacePath(mainStore, qVal ? `/feeds?q=${qVal}` : '/feeds')
  }

  return {
    addToTags, deleteItems, deleteItem, addItemToTags,
    saveFeedsToNotes, savingNotes, syncFeeds,
    viewUrl, view, viewFeed, backToList,
  }
}
