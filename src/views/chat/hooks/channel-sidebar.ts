import { openModal } from '@/components/modal'
import CreateChannelModal from '@/views/chat/CreateChannelModal.vue'
import { useChatStore } from '@/stores/chat'
import type { IChatChannel } from '@/lib/interfaces'

/**
 * Channel-specific sidebar actions: opening the create-channel modal
 * (which on success inserts the new channel into the store and routes
 * to it). Channel deletion lives inside ChannelListItem.
 */
export function useChannelActions(deps: {
  openChat: (id: string) => void
  getChannelChatRouteId: (channelId: string) => string
}) {
  const chatStore = useChatStore()

  function openCreateChannel() {
    openModal(CreateChannelModal, {
      onCreated: (channel: IChatChannel) => {
        if (!chatStore.channels.some((c) => c.id === channel.id)) {
          chatStore.channels = [...chatStore.channels, { ...channel }].sort((a, b) => a.name.localeCompare(b.name))
        }
        deps.openChat(deps.getChannelChatRouteId(channel.id))
      },
    })
  }

  return { openCreateChannel }
}
