import { ref, computed, type ComputedRef } from 'vue'
import { initLazyQuery, chatChannelsGQL } from '@/lib/api/query'
import type { IChatChannel } from '@/lib/interfaces'
import { sortByName } from '@/lib/array'

export interface ChannelRuntime {
  channel: IChatChannel
  keyBytes: Uint8Array
}

class ChannelCacher {
  readonly channelsMap = ref<Map<string, ChannelRuntime>>(new Map())

  readonly channels: ComputedRef<IChatChannel[]> = computed(() =>
    sortByName(Array.from(this.channelsMap.value.values()).map((r) => r.channel), (c) => c.name)
  )

  private readonly lazy = initLazyQuery<{ chatChannels: IChatChannel[] }>({
    handle: (data) => {
      if (!data?.chatChannels) return
      this.applyChannels(data.chatChannels)
    },
    document: chatChannelsGQL,
    variables: () => ({}),
  })

  get loading() {
    return this.lazy.loading
  }

  getChannel(channelId: string): IChatChannel | null {
    return this.channelsMap.value.get(channelId)?.channel ?? null
  }

  getKeyBytes(channelId: string): Uint8Array | null {
    const bytes = this.channelsMap.value.get(channelId)?.keyBytes
    if (!bytes || bytes.length === 0) return null
    return bytes
  }

  mutateChannel(channelId: string, block: (channel: IChatChannel) => void): IChatChannel | null {
    const current = this.channelsMap.value
    const runtime = current.get(channelId)
    if (!runtime) return null
    const newChannel = { ...runtime.channel }
    block(newChannel)
    const newRuntime: ChannelRuntime = { ...runtime, channel: newChannel }
    const next = new Map(current)
    next.set(channelId, newRuntime)
    this.channelsMap.value = next
    return newChannel
  }

  removeChannel(channelId: string): void {
    const current = this.channelsMap.value
    if (!current.has(channelId)) return
    const next = new Map(current)
    next.delete(channelId)
    this.channelsMap.value = next
  }

  upsertChannel(channel: IChatChannel): void {
    const current = this.channelsMap.value
    const existing = current.get(channel.id)
    const keyBytes = existing?.keyBytes ?? new Uint8Array(0)
    const next = new Map(current)
    next.set(channel.id, { channel, keyBytes })
    this.channelsMap.value = next
  }

  replaceChannels(channels: IChatChannel[]): void {
    const current = this.channelsMap.value
    const runtimeMap = new Map<string, ChannelRuntime>()
    for (const channel of channels) {
      const keyBytes = current.get(channel.id)?.keyBytes ?? new Uint8Array(0)
      runtimeMap.set(channel.id, { channel, keyBytes })
    }
    this.channelsMap.value = runtimeMap
  }

  async load(): Promise<void> {
    await this.lazy.fetch()
  }

  private applyChannels(channels: IChatChannel[]): void {
    const runtimeMap = new Map<string, ChannelRuntime>()
    for (const channel of channels) {
      const keyBytes = new Uint8Array(0)
      runtimeMap.set(channel.id, { channel, keyBytes })
    }
    this.channelsMap.value = runtimeMap
  }
}

export const channelCacher = new ChannelCacher()
