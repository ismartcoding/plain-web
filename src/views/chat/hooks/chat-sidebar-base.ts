import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { replacePath } from '@/plugins/router'
import { getFileId } from '@/lib/api/file'
import { useChatStore } from '@/stores/chat'
import { decryptChatId } from './chat-route'
import { isLocalMode } from '@/lib/local-mode'

/**
 * Shared sidebar primitives: current-chat decoding, active checks,
 * route-id helpers, the openChat router push, and the chat-store
 * init on mount. Channel- and peer-specific actions live in their
 * own hooks below.
 *
 * Per-item delete flows (channel delete, peer delete) live inside
 * ChannelListItem / PeerListItem — each list item owns the dropdown
 * UI and the mutation lifecycle for the entity it represents.
 */
export function useChatSidebar() {
  const router = useRouter()
  const mainStore = useMainStore()
  const tempStore = useTempStore()
  const { urlTokenKey } = storeToRefs(tempStore)
  const chatStore = useChatStore()
  const { loading, pairedPeers, allPeers, joinedChannels } = storeToRefs(chatStore)

  const currentChatId = computed(() => {
    if (router.currentRoute.value.path.includes('app-files')) return ''
    const qid = router.currentRoute.value.query.id
    const enc = typeof qid === 'string' && qid !== '' ? qid : ''
    return decryptChatId(enc, urlTokenKey.value)
  })

  function getPeerChatRouteId(peerId: string) {
    return isLocalMode() ? `peer:${peerId}` : getFileId(urlTokenKey.value, `peer:${peerId}`)
  }

  function getChannelChatRouteId(channelId: string) {
    return isLocalMode() ? `channel:${channelId}` : getFileId(urlTokenKey.value, `channel:${channelId}`)
  }

  function isPeerActive(peerId: string) {
    return currentChatId.value === `peer:${peerId}`
  }

  function isChannelActive(channelId: string) {
    return currentChatId.value === `channel:${channelId}`
  }

  function openChat(id: string) {
    if (id === 'local') { replacePath(mainStore, '/chat'); return }
    replacePath(mainStore, `/chat?id=${encodeURIComponent(id)}`)
  }

  function getLatestChatPreview(chatId: string) {
    return chatStore.getLatestChatPreview(chatId)
  }

  function getLatestChatCreatedAt(chatId: string) {
    return chatStore.getLatestChatCreatedAt(chatId)
  }

  onMounted(() => { chatStore.init() })

  return {
    currentChatId, loading,
    pairedPeers, allPeers, joinedChannels,
    getPeerChatRouteId, getChannelChatRouteId,
    isPeerActive, isChannelActive,
    getLatestChatPreview, getLatestChatCreatedAt,
    openChat,
  }
}
