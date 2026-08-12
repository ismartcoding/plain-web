import { ref, computed, type ComputedRef } from 'vue'
import { initLazyQuery, peersGQL } from '@/lib/api/query'
import type { IPeer } from '@/lib/interfaces'
import { PeerStatus } from '@/lib/status'
import { chatCacher } from './chat-cacher'

export type PeerTransportType = 'LAN' | 'AWARE' | 'BLE'

export interface PeerRuntime {
  peer: IPeer
  keyBytes: Uint8Array
  publicKeyBytes: Uint8Array
}

function sortPeers(
  peers: IPeer[],
  chatCache: Record<string, any>,
  onlineMap: Map<string, boolean>,
): IPeer[] {
  return peers.slice().sort((a, b) => {
    const aChat = chatCache[`peer:${a.id}`]?.createdAt ?? ''
    const bChat = chatCache[`peer:${b.id}`]?.createdAt ?? ''
    if (aChat !== bChat) return aChat > bChat ? -1 : 1
    const aOnline = onlineMap.get(a.id) ?? false
    const bOnline = onlineMap.get(b.id) ?? false
    if (aOnline !== bOnline) return aOnline ? -1 : 1
    if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

class PeerCacher {
  readonly peersMap = ref<Map<string, PeerRuntime>>(new Map())
  readonly onlineMap = ref<Map<string, boolean>>(new Map())
  readonly currentTransportMap = ref<Map<string, PeerTransportType>>(new Map())

  readonly pairedPeers: ComputedRef<IPeer[]> = computed(() => {
    const chats = chatCacher.latestChatMap.value
    const online = this.onlineMap.value
    const list = Array.from(this.peersMap.value.values())
      .filter((r) => r.peer.status === PeerStatus.PAIRED)
      .map((r) => ({ ...r.peer, online: online.get(r.peer.id) ?? r.peer.online ?? false }))
    return sortPeers(list, chats, online)
  })

  readonly unpairedPeers: ComputedRef<IPeer[]> = computed(() => {
    const chats = chatCacher.latestChatMap.value
    const online = this.onlineMap.value
    const list = Array.from(this.peersMap.value.values())
      .filter((r) => r.peer.status === PeerStatus.UNPAIRED)
      .map((r) => ({ ...r.peer, online: online.get(r.peer.id) ?? r.peer.online ?? false }))
    return sortPeers(list, chats, online)
  })

  readonly onlinePeerIds: ComputedRef<Set<string>> = computed(() => {
    const next = new Set<string>()
    for (const [id, online] of this.onlineMap.value.entries()) {
      if (online) next.add(id)
    }
    return next
  })

  private readonly lazy = initLazyQuery<{ peers: IPeer[] }>({
    handle: (data) => {
      if (!data?.peers) return
      this.applyPeers(data.peers)
    },
    document: peersGQL,
    variables: () => ({}),
  })

  get loading() {
    return this.lazy.loading
  }

  setOnlineMap(map: Map<string, boolean>): void {
    this.onlineMap.value = new Map(map)
  }

  setOnline(peerId: string, online: boolean): void {
    const current = this.onlineMap.value
    if (current.get(peerId) === online) return
    const next = new Map(current)
    next.set(peerId, online)
    this.onlineMap.value = next
  }

  isPeerOnline(peerId: string): boolean {
    return this.onlineMap.value.get(peerId) === true
  }

  getPeerOnlineStatus(peerId: string): boolean | undefined {
    return this.onlineMap.value.get(peerId)
  }

  getOnlinePeerIds(): Set<string> {
    const next = new Set<string>()
    for (const [id, online] of this.onlineMap.value.entries()) {
      if (online) next.add(id)
    }
    return next
  }

  setCurrentTransport(peerId: string, transportType: PeerTransportType | null): void {
    const current = this.currentTransportMap.value
    if (transportType === null) {
      if (!current.has(peerId)) return
      const next = new Map(current)
      next.delete(peerId)
      this.currentTransportMap.value = next
      return
    }
    if (current.get(peerId) === transportType) return
    const next = new Map(current)
    next.set(peerId, transportType)
    this.currentTransportMap.value = next
  }

  getPeer(peerId: string): IPeer | null {
    return this.peersMap.value.get(peerId)?.peer ?? null
  }

  getKeyBytes(peerId: string): Uint8Array | null {
    const bytes = this.peersMap.value.get(peerId)?.keyBytes
    if (!bytes || bytes.length === 0) return null
    return bytes
  }

  getPublicKeyBytes(peerId: string): Uint8Array | null {
    const bytes = this.peersMap.value.get(peerId)?.publicKeyBytes
    if (!bytes || bytes.length === 0) return null
    return bytes
  }

  mutatePeer(peerId: string, block: (peer: IPeer) => void): IPeer | null {
    const current = this.peersMap.value
    const runtime = current.get(peerId)
    if (!runtime) return null
    const newPeer = { ...runtime.peer }
    block(newPeer)
    const newRuntime: PeerRuntime = { ...runtime, peer: newPeer }
    const next = new Map(current)
    next.set(peerId, newRuntime)
    this.peersMap.value = next
    return newPeer
  }

  removePeer(peerId: string): void {
    const currentPeers = this.peersMap.value
    const currentOnline = this.onlineMap.value
    const currentTransport = this.currentTransportMap.value
    let peersChanged = false
    let onlineChanged = false
    let transportChanged = false
    if (currentPeers.has(peerId)) {
      const next = new Map(currentPeers)
      next.delete(peerId)
      this.peersMap.value = next
      peersChanged = true
    }
    if (currentOnline.has(peerId)) {
      const next = new Map(currentOnline)
      next.delete(peerId)
      this.onlineMap.value = next
      onlineChanged = true
    }
    if (currentTransport.has(peerId)) {
      const next = new Map(currentTransport)
      next.delete(peerId)
      this.currentTransportMap.value = next
      transportChanged = true
    }
    void peersChanged
    void onlineChanged
    void transportChanged
  }

  replacePeers(peers: IPeer[]): void {
    const runtimeMap = new Map<string, PeerRuntime>()
    const onlineMap = new Map<string, boolean>()
    for (const peer of peers) {
      const keyBytes = new Uint8Array(0)
      const publicKeyBytes = new Uint8Array(0)
      runtimeMap.set(peer.id, { peer, keyBytes, publicKeyBytes })
      if (peer.status === PeerStatus.PAIRED) {
        onlineMap.set(peer.id, !!peer.online)
      }
    }
    this.peersMap.value = runtimeMap
    this.onlineMap.value = onlineMap
  }

  async load(): Promise<void> {
    await this.lazy.fetch()
  }

  private applyPeers(peers: IPeer[]): void {
    this.replacePeers(peers)
  }
}

export const peerCacher = new PeerCacher()
