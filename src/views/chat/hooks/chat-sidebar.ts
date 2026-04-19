import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { replacePath } from '@/plugins/router'
import type { IChatChannel } from '@/lib/interfaces'
import { getFileId } from '@/lib/api/file'
import { openModal } from '@/components/modal'
import CreateChannelModal from '@/views/chat/CreateChannelModal.vue'
import { useChatStore } from '@/stores/chat'
import { decryptChatId } from './chat-route'

export function useChatSidebar() {
  const router = useRouter()
  const mainStore = useMainStore()
  const { urlTokenKey } = storeToRefs(useTempStore())
  const chatStore = useChatStore()
  const { loading, pairedPeers, unpairedPeers, joinedChannels } = storeToRefs(chatStore)

  const currentEncryptedId = computed(() => {
    const qid = router.currentRoute.value.query.id
    return typeof qid === 'string' && qid !== '' ? qid : ''
  })

  const currentChatId = computed(() => {
    if (router.currentRoute.value.path.includes('app-files')) return ''
    return decryptChatId(currentEncryptedId.value, urlTokenKey.value)
  })

  function getPeerChatRouteId(peerId: string) { return getFileId(urlTokenKey.value, `peer:${peerId}`) }
  function getChannelChatRouteId(channelId: string) { return getFileId(urlTokenKey.value, `channel:${channelId}`) }
  function isPeerActive(peerId: string) { return currentChatId.value === `peer:${peerId}` }
  function isChannelActive(channelId: string) { return currentChatId.value === `channel:${channelId}` }

  function openChat(id: string) {
    if (id === 'local') { replacePath(mainStore, '/chat'); return }
    replacePath(mainStore, `/chat?id=${encodeURIComponent(id)}`)
  }

  function openCreateChannel() {
    openModal(CreateChannelModal, {
      onCreated: (channel: IChatChannel) => {
        if (!chatStore.channels.some((c) => c.id === channel.id)) {
          chatStore.channels = [...chatStore.channels, { ...channel }].sort((a, b) => a.name.localeCompare(b.name))
        }
        openChat(getChannelChatRouteId(channel.id))
      },
    })
  }

  onMounted(() => { chatStore.init() })

  return {
    currentChatId, loading,
    pairedPeers, unpairedPeers, joinedChannels,
    isPeerActive, isChannelActive,
    getPeerChatRouteId, getChannelChatRouteId,
    openChat, openCreateChannel,
  }
}

