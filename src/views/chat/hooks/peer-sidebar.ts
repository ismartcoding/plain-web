import { openModal } from '@/components/modal'
import NearbyModal from '@/views/chat/NearbyModal.vue'
import { useChatStore } from '@/stores/chat'

/**
 * Peer-specific sidebar actions: the "discover & pair" modal entry
 * point and the post-pair side effect (refresh peer list, then open
 * the chat). Peer deletion lives inside PeerListItem.
 */
export function usePeerActions(deps: {
  openChat: (id: string) => void
  getPeerChatRouteId: (peerId: string) => string
}) {
  const chatStore = useChatStore()

  async function onPeerPaired(peerId: string) {
    await chatStore.fetchPeers()
    deps.openChat(deps.getPeerChatRouteId(peerId))
  }

  function openNearby() {
    openModal(NearbyModal, { onPaired: onPeerPaired })
  }

  return { openNearby, onPeerPaired }
}
