import { computed, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { useChatStore } from '@/stores/chat'
import type { IChatItem } from '@/lib/interfaces'

export function useChatData(chatId: ComputedRef<string>, peerId: ComputedRef<string>, isChannel: ComputedRef<boolean>, channelId: ComputedRef<string>) {
  const { t } = useI18n()
  const { app } = storeToRefs(useTempStore())
  const chatStore = useChatStore()
  const { peers } = storeToRefs(chatStore)

  const peer = computed(() => chatStore.findPeer(peerId.value))
  const channel = computed(() => chatStore.findChannel(channelId.value))

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

  return { peers, peer, channel, pageTitle, getSenderName, fetchChannels: chatStore.fetchChannels }
}


