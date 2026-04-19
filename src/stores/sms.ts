import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { initLazyQuery, smsConversationsGQL, archivedConversationsGQL, smsCountGQL } from '@/lib/api/query'
import { initMutation, archiveConversationGQL, unarchiveConversationGQL } from '@/lib/api/mutation'
import type { IMessageConversation } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { getCached, setCached } from '@/lib/api/cache'

const LIMIT = 50

type SmsCountsCache = { total: number; inbox: number; sent: number; drafts: number }
type ConversationsCache = { conversations: IMessageConversation[]; count: number }

export const useSmsStore = defineStore('sms', () => {
  const conversations = ref<IMessageConversation[]>([])
  const conversationCount = ref(0)
  const typesCount = ref<Map<string, number>>(new Map())
  const page = ref(1)
  const q = ref('')
  const noMore = ref(false)

  const { loading: normalLoading, fetch: _fetchNormal } = initLazyQuery({
    handle: (data: { smsConversations: IMessageConversation[]; smsConversationCount: number }, error: string) => {
      if (error) {
        emitter.emit('toast', error)
      } else if (data) {
        const items = data.smsConversations.map((c) => ({ ...c }))
        noMore.value = items.length < LIMIT
        if (page.value === 1) {
          conversations.value = items
          setCached<ConversationsCache>(`sms:conversations:${q.value}`, { conversations: items, count: data.smsConversationCount })
        } else {
          conversations.value = [...conversations.value, ...items]
        }
        conversationCount.value = data.smsConversationCount
      }
    },
    document: smsConversationsGQL,
    variables: () => ({ offset: (page.value - 1) * LIMIT, limit: LIMIT, query: q.value }),
  })

  const { loading: archivedLoading, fetch: _fetchArchived } = initLazyQuery({
    handle: (data: { archivedConversations: IMessageConversation[] }, error: string) => {
      if (error) {
        emitter.emit('toast', error)
      } else if (data) {
        const items = data.archivedConversations.map((c) => ({ ...c }))
        conversations.value = items
        conversationCount.value = items.length
        noMore.value = true
        setCached<IMessageConversation[]>('sms:archived', items)
      }
    },
    document: archivedConversationsGQL,
    variables: () => ({}),
  })

  const { fetch: _fetchCounts } = initLazyQuery({
    handle: (data: { smsAllCounts: SmsCountsCache }) => {
      if (data?.smsAllCounts) {
        const c = data.smsAllCounts
        useTempStore().counter.messages = c.total
        typesCount.value = new Map([['1', c.inbox], ['2', c.sent], ['3', c.drafts]])
        setCached<SmsCountsCache>('sms:counts', c)
      }
    },
    document: smsCountGQL,
    variables: () => ({}),
  })

  const { mutate: mutateArchive } = initMutation({ document: archiveConversationGQL })
  const { mutate: mutateUnarchive } = initMutation({ document: unarchiveConversationGQL })

  function fetchConversations(query = '', reset = true) {
    if (reset) {
      page.value = 1
      q.value = query
      const cached = getCached<ConversationsCache>(`sms:conversations:${query}`)
      if (cached) {
        // SWR: show cached data immediately, fetch fresh in background
        conversations.value = cached.conversations
        conversationCount.value = cached.count
      } else {
        conversations.value = []
        noMore.value = false
      }
    }
    _fetchNormal()
  }

  function fetchMoreConversations() {
    if (noMore.value || normalLoading.value) return
    page.value++
    _fetchNormal()
  }

  function fetchArchived() {
    const cached = getCached<IMessageConversation[]>('sms:archived')
    if (cached) {
      // SWR: show cached data immediately, fetch fresh in background
      conversations.value = cached
      conversationCount.value = cached.length
      noMore.value = true
    } else {
      conversations.value = []
      noMore.value = false
    }
    _fetchArchived()
  }

  function fetchCounts() {
    const cached = getCached<SmsCountsCache>('sms:counts')
    if (cached) {
      // SWR: apply cached counts immediately, fetch fresh in background
      useTempStore().counter.messages = cached.total
      typesCount.value = new Map([['1', cached.inbox], ['2', cached.sent], ['3', cached.drafts]])
    }
    _fetchCounts()
  }

  function archiveConversations(ids: string[]) {
    const idSet = new Set(ids)
    conversations.value = conversations.value.filter((c) => !idSet.has(c.id))
    // Keep conversation cache consistent so SWR doesn't flash removed items
    const cacheKey = `sms:conversations:${q.value}`
    const cached = getCached<ConversationsCache>(cacheKey)
    if (cached) {
      setCached<ConversationsCache>(cacheKey, {
        conversations: cached.conversations.filter((c) => !idSet.has(c.id)),
        count: Math.max(0, cached.count - ids.length),
      })
    }
    const date = Date.now()
    for (const id of ids) mutateArchive({ id, date })
  }

  function unarchiveConversations(ids: string[]) {
    const idSet = new Set(ids)
    conversations.value = conversations.value.filter((c) => !idSet.has(c.id))
    // Keep archived cache consistent
    const cached = getCached<IMessageConversation[]>('sms:archived')
    if (cached) {
      setCached<IMessageConversation[]>('sms:archived', cached.filter((c) => !idSet.has(c.id)))
    }
    for (const id of ids) mutateUnarchive({ id })
  }

  const loading = computed(() => normalLoading.value || archivedLoading.value)

  return {
    conversations,
    conversationCount,
    typesCount,
    noMore,
    loading,
    normalLoading,
    archivedLoading,
    fetchConversations,
    fetchMoreConversations,
    fetchArchived,
    fetchCounts,
    archiveConversations,
    unarchiveConversations,
  }
})
