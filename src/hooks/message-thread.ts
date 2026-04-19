import { computed, nextTick, ref, watch, type Ref } from 'vue'
import toast from '@/components/toaster'
import { initLazyQuery, smsGQL } from '@/lib/api/query'
import { useI18n } from 'vue-i18n'
import { buildQuery } from '@/lib/search'
import type { IItemTagsUpdatedEvent, IItemsTagsUpdatedEvent, IMessage, INotification } from '@/lib/interfaces'
import { useTags } from '@/hooks/tags'
import { useContactName } from '@/hooks/contacts'
import { DataType } from '@/lib/data'
import emitter from '@/plugins/eventbus'
import { createPendingSms, createPendingMms } from '@/lib/message-helpers'

const PAGE_SIZE = 100

export function useMessageThread(threadId: Ref<string>, chatScrollRef: Ref<HTMLElement | undefined>, isArchived?: Ref<boolean>) {
  const { t } = useI18n()
  const { loadContacts, getContactName, getDisplayName } = useContactName()
  const { tags, fetch: fetchTags } = useTags(DataType.SMS)

  const items = ref<IMessage[]>([])
  const detailLoading = ref(false)
  const offset = ref(0)
  const noMoreOlder = ref(false)
  const loadingMore = ref(false)
  const pendingMmsItem = ref<IMessage | null>(null)
  const pendingSmsItem = ref<IMessage | null>(null)
  let pendingSmsPreCount = 0

  const contactName = computed(() => {
    const address = items.value[0]?.address || ''
    return address ? getDisplayName(address) : ''
  })

  const contactAddress = computed(() => {
    const address = items.value[0]?.address || ''
    return getContactName(address) ? address : ''
  })

  const sortedItems = computed(() => {
    const base = [...items.value].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const pending: IMessage[] = []
    if (pendingSmsItem.value && !base.some((it) => it.id === pendingSmsItem.value?.id)) pending.push(pendingSmsItem.value)
    if (pendingMmsItem.value && !base.some((it) => it.id === pendingMmsItem.value?.id)) pending.push(pendingMmsItem.value)
    return pending.length ? [...base, ...pending] : base
  })

  function scrollToBottom() {
    nextTick(() => { if (chatScrollRef.value) chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight })
  }

  const { loading, fetch: rawFetch } = initLazyQuery({
    handle: (data: { sms: IMessage[]; smsCount: number }, error: string) => {
      if (error) {
        detailLoading.value = false
        loadingMore.value = false
        toast(t(error), 'error')
      } else if (data) {
        if (loadingMore.value) {
          const el = chatScrollRef.value
          const prevScrollHeight = el?.scrollHeight ?? 0
          const existingIds = new Set(items.value.map((i) => i.id))
          items.value = [...data.sms.filter((i) => !existingIds.has(i.id)), ...items.value]
          if (data.sms.length < PAGE_SIZE) noMoreOlder.value = true
          loadingMore.value = false
          nextTick(() => { if (el) el.scrollTop = el.scrollHeight - prevScrollHeight })
        } else {
          detailLoading.value = false
          items.value = data.sms
          if (data.sms.length < PAGE_SIZE) noMoreOlder.value = true
          pendingSmsItem.value = null
          scrollToBottom()
        }
      }
    },
    document: smsGQL,
    variables: () => {
      const fields = [{ name: 'thread_id', op: '', value: threadId.value }]
      if (isArchived?.value) fields.push({ name: 'archived', op: '', value: '1' })
      return { offset: offset.value, limit: PAGE_SIZE, query: buildQuery(fields) }
    },
  })

  function fetch() { offset.value = 0; noMoreOlder.value = false; loadingMore.value = false; rawFetch() }

  function fetchMore() {
    if (loadingMore.value || noMoreOlder.value || loading.value) return
    loadingMore.value = true; offset.value = items.value.length; rawFetch()
  }

  function onScroll() {
    if (!chatScrollRef.value || loadingMore.value || noMoreOlder.value || loading.value) return
    if (chatScrollRef.value.scrollTop < 200) fetchMore()
  }

  function refetchWithRetry() {
    const prev = items.value.length; const delays = [1000, 2000, 3000]; let attempt = 0
    function tryFetch() { fetch(); attempt++; if (attempt < delays.length) setTimeout(() => { if (items.value.length <= prev) tryFetch() }, delays[attempt]) }
    setTimeout(tryFetch, delays[0])
  }

  function setPendingSms(body: string, address: string) {
    pendingSmsPreCount = items.value.length
    pendingSmsItem.value = createPendingSms(body, address, threadId.value)
    scrollToBottom()
  }

  function setPendingMms(id: string, body: string, address: string, attachments: IMessage['attachments']) {
    pendingMmsItem.value = createPendingMms(id, body, address, threadId.value, attachments)
    scrollToBottom()
  }

  watch(items, (v) => { if (pendingMmsItem.value && v.some((it) => it.id === pendingMmsItem.value?.id)) pendingMmsItem.value = null })

  function applyThread(tid: string) {
    threadId.value = tid
    if (!tid) { items.value = []; detailLoading.value = false; return }
    pendingMmsItem.value = null; items.value = []; detailLoading.value = true; fetch()
  }

  const onItemsTagsUpdated = (e: IItemsTagsUpdatedEvent) => { if (e.type === DataType.SMS) fetch() }
  const onItemTagsUpdated = (e: IItemTagsUpdatedEvent) => { if (e.type === DataType.SMS) fetch() }
  const onNotificationCreated = (data: INotification) => { if (data.appId === 'com.android.mms') fetch() }

  function subscribe() {
    fetchTags(); loadContacts()
    emitter.on('item_tags_updated', onItemTagsUpdated)
    emitter.on('items_tags_updated', onItemsTagsUpdated)
    emitter.on('notification_created', onNotificationCreated)
  }

  function unsubscribe() {
    emitter.off('item_tags_updated', onItemTagsUpdated)
    emitter.off('items_tags_updated', onItemsTagsUpdated)
    emitter.off('notification_created', onNotificationCreated)
  }

  return {
    items, sortedItems, detailLoading, loading, loadingMore, tags, contactName, contactAddress,
    fetch, refetchWithRetry, onScroll, scrollToBottom, applyThread, setPendingSms, setPendingMms, subscribe, unsubscribe,
  }
}
