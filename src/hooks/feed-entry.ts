import { useRoute } from 'vue-router'
import { onActivated, onDeactivated, inject, ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { feedEntryGQL, initLazyQuery, initQuery, tagsGQL } from '@/lib/api/query'
import type { IFeedEntryDetail, IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, ITag } from '@/lib/interfaces'
import { useSafeMarkdown } from '@/hooks/markdown'
import { openModal } from '@/components/modal'
import UpdateTagRelationsModal from '@/components/UpdateTagRelationsModal.vue'
import emitter from '@/plugins/eventbus'
import { initMutation, saveFeedEntriesToNotesGQL, syncFeedContentGQL } from '@/lib/api/mutation'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { useMainStore } from '@/stores/main'
import { useFeeds } from '@/hooks/feeds'
import { replacePath } from '@/plugins/router'

const dataType = 'FEED_ENTRY'

export function useFeedEntry() {
  const { t } = useI18n()
  const isPhone = inject<boolean>('isPhone')
  const route = useRoute()
  const id = ref(route.params.id)
  const entry = ref<IFeedEntryDetail>()
  const markdown = ref('')
  const tags = ref<ITag[]>()
  const { app, urlTokenKey } = storeToRefs(useTempStore())
  const mainStore = useMainStore()

  const { render } = useSafeMarkdown(app, urlTokenKey)
  const { loading, fetch } = initLazyQuery({
    handle: async (data: { feedEntry: IFeedEntryDetail }, error: string) => {
      if (error) toast(t(error), 'error')
      else {
        entry.value = data.feedEntry
        markdown.value = entry.value ? await render(data.feedEntry.content || data.feedEntry.description) : ''
      }
    },
    document: feedEntryGQL,
    variables: () => ({ id: id.value }),
  })

  const { viewFeed } = useFeeds(mainStore)

  function backToList() {
    const q = route.query.q
    replacePath(mainStore, q ? `/feeds?q=${q}` : '/feeds')
  }

  const { mutate: saveToNotes, onDone: onSaveToNotesDone } = initMutation({ document: saveFeedEntriesToNotesGQL })
  onSaveToNotesDone(() => toast(t('saved')))

  initQuery({
    handle: (data: { tags: ITag[] }, error: string) => {
      if (error) toast(t(error), 'error')
      else if (data) tags.value = data.tags
    },
    document: tagsGQL,
    variables: { type: dataType },
  })

  function addToTags() {
    openModal(UpdateTagRelationsModal, {
      type: dataType, tags: tags.value,
      item: { key: entry.value?.id, title: '', size: 0 },
      selected: tags.value?.filter((it) => entry.value?.tags.some((t) => t.id === it.id)),
    })
  }

  const { mutate: syncFeedContent, loading: syncContentLoading, onDone: syncContentDone } = initMutation({ document: syncFeedContentGQL })
  syncContentDone(async (r: any) => {
    entry.value = r.data.syncFeedContent
    markdown.value = await render(r.data.syncFeedContent.content || r.data.syncFeedContent.description)
  })

  const syncContent = () => syncFeedContent({ id: id.value })
  const print = () => window.print()

  const itemTagsHandler = (event: IItemTagsUpdatedEvent | IItemsTagsUpdatedEvent) => { if (event.type === dataType) fetch() }

  onActivated(() => {
    emitter.on('item_tags_updated', itemTagsHandler)
    emitter.on('items_tags_updated', itemTagsHandler)
    fetch()
  })

  onDeactivated(() => {
    emitter.off('item_tags_updated', itemTagsHandler)
    emitter.off('items_tags_updated', itemTagsHandler)
  })

  return {
    id, entry, markdown, loading, isPhone, dataType, mainStore,
    syncContentLoading, viewFeed, addToTags, syncContent, saveToNotes, print, backToList,
  }
}
