import { ref, computed, onMounted, onUnmounted, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { initLazyQuery, peersGQL, chatChannelsGQL } from '@/lib/api/query'
import type { IPeer, IChatChannel, IChatItem } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'

export function useChatData(chatId: ComputedRef<string>, peerId: ComputedRef<string>, isChannel: ComputedRef<boolean>, channelId: ComputedRef<string>) {
  const { t } = useI18n()
  const { app } = storeToRefs(useTempStore())
  const peers = ref<IPeer[]>([])
  const channels = ref<IChatChannel[]>([])

  const peer = computed(() => peers.value.find((p) => p.id === peerId.value) ?? null)
  const channel = computed(() => channels.value.find((c) => c.id === channelId.value) ?? null)

  const pageTitle = computed(() => {
    if (chatId.value === 'local') return app.value?.deviceName ?? t('my_phone')
    if (isChannel.value) return channel.value?.name ?? channelId.value
    return peer.value?.name ?? peerId.value
  })

  function getSenderName(chatItem: IChatItem) {
    if (chatItem.fromId === 'me') return t('me')
    if (chatId.value === 'local') return app.value?.deviceName ?? t('my_phone')
    if (isChannel.value) {
      const senderPeer = peers.value.find((p) => p.id === chatItem.fromId)
      return senderPeer?.name ?? chatItem.fromId.substring(0, 8)
    }
    return peer.value?.name ?? chatItem.fromId
  }

  initLazyQuery({
    handle: (data: { peers: IPeer[] }) => {
      if (data?.peers) peers.value = data.peers
    },
    document: peersGQL,
    variables: () => ({}),
  }).fetch()

  const channelsQuery = initLazyQuery({
    handle: (data: { chatChannels: IChatChannel[] }) => {
      if (data?.chatChannels) channels.value = data.chatChannels.map((c: any) => ({ ...c }))
    },
    document: chatChannelsGQL,
    variables: () => ({}),
  })
  channelsQuery.fetch()

  let handler: ((...args: any[]) => void) | null = null

  onMounted(() => {
    handler = (data: any[]) => {
      if (data) channels.value = data.map((c: any) => ({ ...c }))
    }
    emitter.on('channels_updated', handler)
  })

  onUnmounted(() => {
    if (handler) emitter.off('channels_updated', handler)
  })

  return { peers, channels, peer, channel, pageTitle, getSenderName, fetchChannels: channelsQuery.fetch }
}
