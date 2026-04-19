import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { initLazyQuery, peersGQL, chatChannelsGQL } from '@/lib/api/query'
import type { IPeer, IChatChannel } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { getCached, setCached } from '@/lib/api/cache'

/**
 * Global store for chat peers and channels.
 * Uses stale-while-revalidate: init() shows cached data immediately then
 * revalidates in the background. Concurrent calls from multiple components
 * are safe — gqlFetch deduplicates identical in-flight requests.
 */
export const useChatStore = defineStore('chat', () => {
  const peers = ref<IPeer[]>([])
  const channels = ref<IChatChannel[]>([])

  const pairedPeers = computed(() => peers.value.filter((p) => p.status === 'paired'))
  const unpairedPeers = computed(() => peers.value.filter((p) => p.status === 'unpaired'))
  const joinedChannels = computed(() => channels.value.filter((c) => c.status === 'joined'))

  const { fetch: _fetchPeers, loading } = initLazyQuery({
    handle: (data: { peers: IPeer[] }) => {
      if (data?.peers) {
        peers.value = data.peers
        setCached<IPeer[]>('chat:peers', data.peers)
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

  // Single global listener — lives for the app lifetime.
  emitter.on('channels_updated', (data: any[]) => {
    if (data) {
      channels.value = data.map((c: any) => ({ ...c }))
      setCached<IChatChannel[]>('chat:channels', channels.value)
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

    _fetchPeers()
    _fetchChannels()
  }

  function findPeer(id: string): IPeer | null {
    return peers.value.find((p) => p.id === id) ?? null
  }

  function findChannel(id: string): IChatChannel | null {
    return channels.value.find((c) => c.id === id) ?? null
  }

  return {
    peers,
    channels,
    loading,
    pairedPeers,
    unpairedPeers,
    joinedChannels,
    findPeer,
    findChannel,
    fetchChannels: _fetchChannels,
    init,
  }
})
