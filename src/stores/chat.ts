import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { initLazyQuery, peersGQL, chatChannelsGQL, latestChatItemsGQL } from '@/lib/api/query'
import type { IPeer, IChatChannel, IChatItem } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { getCached, setCached } from '@/lib/api/cache'
import { get as prefsGet } from '@/lib/prefs'
import { openModal } from '@/components/modal'
import ChannelInviteModal from '@/views/chat/ChannelInviteModal.vue'

/**
 * Global store for chat peers and channels.
 * Uses stale-while-revalidate: init() shows cached data immediately then
 * revalidates in the background. Concurrent calls from multiple components
 * are safe — gqlFetch deduplicates identical in-flight requests.
 */
export const useChatStore = defineStore('chat', () => {
  const peers = ref<IPeer[]>([])
  const channels = ref<IChatChannel[]>([])
  const latestChatMap = ref<Record<string, IChatItem>>({})

  const pairedPeers = computed(() => peers.value.filter((p) => p.status === 'paired'))
  const unpairedPeers = computed(() => peers.value.filter((p) => p.status === 'unpaired'))
  const allPeers = computed(() => [...pairedPeers.value, ...unpairedPeers.value])
  const joinedChannels = computed(() => channels.value.filter((c) => c.status === 'joined'))

  const { fetch: _fetchPeers, loading } = initLazyQuery({
    handle: (data: { peers: IPeer[] }) => {
      if (data?.peers) {
        peers.value = data.peers
        setCached<IPeer[]>('chat:peers', data.peers)
        // latestChatItems folding depends on peer ids, so refresh after peers update.
        _fetchLatestChatItems()
      }
    },
    document: peersGQL,
    variables: () => ({}),
  })

  const { fetch: _fetchChannels } = initLazyQuery({
    handle: (data: { chatChannels: IChatChannel[] }) => {
      if (data?.chatChannels) {
        channels.value = data.chatChannels.map((c: any) => ({ ...c }))
        setCached<IChatChannel[]>('chat:channels', channels.value)
      }
    },
    document: chatChannelsGQL,
    variables: () => ({}),
  })

  const { fetch: _fetchLatestChatItems } = initLazyQuery({
    handle: (data: { latestChatItems: IChatItem[] }) => {
      if (data?.latestChatItems) {
        const next: Record<string, IChatItem> = {}
        data.latestChatItems.forEach((item) => {
          const normalized = normalizeChatItem(item)
          const chatId = mapChatId(normalized)
          if (!chatId) return
          // latestChatItems is already sorted by createdAt DESC from backend.
          // Keep the first hit per chat conversation after folding directions.
          if (!next[chatId]) next[chatId] = normalized
        })
        latestChatMap.value = next
        setCached<Record<string, IChatItem>>('chat:latest_items', next)
      }
    },
    document: latestChatItemsGQL,
    variables: () => ({}),
  })

  function normalizeChatItem(item: any): IChatItem {
    let parsedContent = null
    try {
      parsedContent = item?._content ?? (item?.content ? JSON.parse(item.content) : null)
    } catch {
      parsedContent = null
    }
    return {
      ...item,
      _content: parsedContent,
      __typename: item?.__typename ?? 'ChatItem',
    }
  }

  function mapChatId(item: IChatItem): string {
    if (item.channelId) return `channel:${item.channelId}`
    const fromId = item.fromId ?? ''
    const toId = item.toId ?? ''
    const localClientId = getLocalClientId()

    const peerIdSet = new Set(peers.value.map((p) => p.id))
    const isFromPeer = !!fromId && peerIdSet.has(fromId)
    const isToPeer = !!toId && peerIdSet.has(toId)
    const isFromLocal = isLocalEndpoint(fromId, localClientId)
    const isToLocal = isLocalEndpoint(toId, localClientId)

    if (isToPeer) return `peer:${toId}`
    if (isFromPeer) return `peer:${fromId}`
    if (isFromLocal || isToLocal) return 'peer:local'
    if (toId) return `peer:${toId}`
    if (fromId) return `peer:${fromId}`

    return 'peer:local'
  }

  function getLocalClientId(): string {
    return prefsGet('client_id', '')
  }

  function isLocalEndpoint(id: string, localClientId: string): boolean {
    return id === '' || id === 'local' || (!!localClientId && id === localClientId)
  }

  function getLatestChat(chatId: string): IChatItem | null {
    return latestChatMap.value[chatId] ?? null
  }

  function getLatestChatPreview(chatId: string): string {
    const item = getLatestChat(chatId)
    if (!item) return ''
    const content = item._content
    if (content?.type === 'text') return (content?.value?.text ?? '').slice(0, 50)
    if (content?.type === 'images') {
      const count = content?.value?.ids?.length ?? 0
      return count > 1 ? `[${count} images]` : '[Image]'
    }
    if (content?.type === 'files') {
      const count = content?.value?.ids?.length ?? 0
      return count > 1 ? `[${count} files]` : '[File]'
    }
    return '[Message]'
  }

  function getLatestChatCreatedAt(chatId: string): string {
    return getLatestChat(chatId)?.createdAt ?? ''
  }

  // Single global listener — lives for the app lifetime.
  emitter.on('channels_updated', (data: any[]) => {
    if (data) {
      channels.value = data.map((c: any) => ({ ...c }))
      setCached<IChatChannel[]>('chat:channels', channels.value)
    }
  })

  emitter.on('peer_status_updated', (data) => {
    if (!data?.id) return
    peers.value = peers.value.map((peer) => peer.id === data.id ? { ...peer, online: !!data.online } : peer)
    setCached<IPeer[]>('chat:peers', peers.value)
  })

  emitter.on('channel_invite_received', (data) => {
    if (!data?.channelId) return
    // De-dupe: if a modal is already up for this channel, ignore.
    const invite = {
      channelId: data.channelId,
      channelName: data.channelName ?? '',
      fromId: data.fromId ?? '',
      fromName: data.fromName ?? '',
    }
    console.debug('[chat] channel_invite_received', invite)
    try {
      openModal(ChannelInviteModal, {
        invite,
        onResponded: (channelId: string, accepted: boolean) => {
          if (!accepted) {
            // Backend already deleted the channel and fired channels_updated.
            // The normal listener above will refresh the list; no extra work.
            removeChannel(channelId)
          }
        },
      })
    } catch (e) {
      // openModal throws if another modal is already queued or the modal
      // system is not yet initialized. Fall back to a deferred push on
      // next tick so the user still gets prompted.
      console.error('[chat] failed to open channel invite modal', e)
      setTimeout(() => {
        try {
          openModal(ChannelInviteModal, {
            invite,
            onResponded: (channelId: string, accepted: boolean) => {
              if (!accepted) removeChannel(channelId)
            },
          })
        } catch (e2) {
          console.error('[chat] deferred openModal also failed', e2)
        }
      }, 500)
    }
  })

  emitter.on('message_created', (items: any[]) => {
    if (!Array.isArray(items)) return
    // Newly created messages are the newest state for their chat.
    items.map(normalizeChatItem).forEach((item) => {
      const chatId = mapChatId(item)
      if (!chatId) return
      latestChatMap.value = { ...latestChatMap.value, [chatId]: item }
    })
    setCached<Record<string, IChatItem>>('chat:latest_items', latestChatMap.value)
  })

  emitter.on('message_updated', (items: any[]) => {
    if (!Array.isArray(items)) return
    const next = { ...latestChatMap.value }
    let changed = false
    items.map(normalizeChatItem).forEach((item) => {
      const chatId = mapChatId(item)
      if (!chatId) return
      if (next[chatId]?.id === item.id) {
        next[chatId] = item
        changed = true
      }
    })
    if (changed) {
      latestChatMap.value = next
      setCached<Record<string, IChatItem>>('chat:latest_items', latestChatMap.value)
    }
  })

  emitter.on('message_deleted', (data: string) => {
    if (typeof data !== 'string') return
    if (data.startsWith('ids=')) {
      const ids = data.slice(4).split(',').filter(Boolean)
      if (!ids.length) return
      const deleted = new Set(ids)
      const hasLatestDeleted = Object.values(latestChatMap.value).some((item) => deleted.has(item.id))
      if (hasLatestDeleted) _fetchLatestChatItems()
    } else if (latestChatMap.value[data]) {
      const next = { ...latestChatMap.value }
      delete next[data]
      latestChatMap.value = next
      setCached<Record<string, IChatItem>>('chat:latest_items', latestChatMap.value)
    }
  })

  /**
   * Call on every activation. Shows cached data immediately (no flash),
   * then fetches fresh data in the background.
   */
  function init() {
    const cachedPeers = getCached<IPeer[]>('chat:peers')
    if (cachedPeers) peers.value = cachedPeers

    const cachedChannels = getCached<IChatChannel[]>('chat:channels')
    if (cachedChannels) channels.value = cachedChannels

    const cachedLatest = getCached<Record<string, IChatItem>>('chat:latest_items')
    if (cachedLatest) latestChatMap.value = cachedLatest

    _fetchPeers()
    _fetchChannels()
    _fetchLatestChatItems()
  }

  function findPeer(id: string): IPeer | null {
    return peers.value.find((p) => p.id === id) ?? null
  }

  function findChannel(id: string): IChatChannel | null {
    return channels.value.find((c) => c.id === id) ?? null
  }

  function updateChannel(channel: IChatChannel) {
    const next = channels.value.map((c) => c.id === channel.id ? { ...channel } : c)
    channels.value = next
    setCached<IChatChannel[]>('chat:channels', next)
  }

  function removeChannel(channelId: string) {
    if (!channels.value.some((c) => c.id === channelId)) return
    const next = channels.value.filter((c) => c.id !== channelId)
    channels.value = next
    setCached<IChatChannel[]>('chat:channels', next)
  }

  return {
    peers,
    channels,
    latestChatMap,
    loading,
    pairedPeers,
    unpairedPeers,
    allPeers,
    joinedChannels,
    findPeer,
    findChannel,
    updateChannel,
    removeChannel,
    getLatestChat,
    getLatestChatPreview,
    getLatestChatCreatedAt,
    fetchPeers: _fetchPeers,
    fetchChannels: _fetchChannels,
    fetchLatestChatItems: _fetchLatestChatItems,
    init,
  }
})
