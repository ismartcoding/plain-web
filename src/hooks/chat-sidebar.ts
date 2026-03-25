import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { replacePath } from '@/plugins/router'
import { initLazyQuery, peersGQL, chatChannelsGQL } from '@/lib/api/query'
import type { IPeer, IChatChannel } from '@/lib/interfaces'
import { getFileId } from '@/lib/api/file'
import { chachaDecrypt } from '@/lib/api/crypto'
import { openModal } from '@/components/modal'
import CreateChannelModal from '@/views/chat/CreateChannelModal.vue'
import emitter from '@/plugins/eventbus'
import * as sjcl from 'sjcl'

export function useChatSidebar() {
  const router = useRouter()
  const mainStore = useMainStore()
  const { urlTokenKey } = storeToRefs(useTempStore())
  const peers = ref<IPeer[]>([])
  const channels = ref<IChatChannel[]>([])

  const currentEncryptedId = computed(() => {
    const qid = router.currentRoute.value.query.id
    return typeof qid === 'string' && qid !== '' ? qid : ''
  })

  const currentChatId = computed(() => {
    if (router.currentRoute.value.path.includes('app-files')) return ''
    if (!currentEncryptedId.value) return 'local'
    if (!urlTokenKey.value) return ''
    try {
      const bits = sjcl.codec.base64.toBits(currentEncryptedId.value)
      const decrypted = chachaDecrypt(urlTokenKey.value, bits)
      if (decrypted.startsWith('peer:') || decrypted.startsWith('channel:')) return decrypted
      return 'local'
    } catch { return 'local' }
  })

  const pairedPeers = computed(() => peers.value.filter((p) => p.status === 'paired'))
  const unpairedPeers = computed(() => peers.value.filter((p) => p.status === 'unpaired'))
  const joinedChannels = computed(() => channels.value.filter((c) => c.status === 'joined'))

  function getPeerChatRouteId(peerId: string) { return getFileId(urlTokenKey.value, `peer:${peerId}`) }
  function getChannelChatRouteId(channelId: string) { return getFileId(urlTokenKey.value, `channel:${channelId}`) }
  function isPeerActive(peerId: string) { return currentChatId.value === `peer:${peerId}` }
  function isChannelActive(channelId: string) { return currentChatId.value === `channel:${channelId}` }

  const { fetch: fetchPeers, loading } = initLazyQuery({
    handle: (data: { peers: IPeer[] }) => { if (data?.peers) peers.value = data.peers },
    document: peersGQL,
    variables: () => ({}),
  })

  const { fetch: fetchChannels } = initLazyQuery({
    handle: (data: { chatChannels: IChatChannel[] }) => { if (data?.chatChannels) channels.value = data.chatChannels.map((c: any) => ({ ...c })) },
    document: chatChannelsGQL,
    variables: () => ({}),
  })

  function openChat(id: string) {
    if (id === 'local') { replacePath(mainStore, '/chat'); return }
    replacePath(mainStore, `/chat?id=${encodeURIComponent(id)}`)
  }

  function openCreateChannel() {
    openModal(CreateChannelModal, {
      onCreated: (channel: IChatChannel) => {
        channels.value = [...channels.value, { ...channel }].sort((a, b) => a.name.localeCompare(b.name))
        openChat(getChannelChatRouteId(channel.id))
      },
    })
  }

  const channelsUpdatedHandler = (data: any[]) => { if (data) channels.value = data.map((c: any) => ({ ...c })) }

  onMounted(() => {
    fetchPeers(); fetchChannels()
    emitter.on('channels_updated', channelsUpdatedHandler)
  })

  onUnmounted(() => { emitter.off('channels_updated', channelsUpdatedHandler) })

  return {
    currentChatId, loading,
    pairedPeers, unpairedPeers, joinedChannels,
    isPeerActive, isChannelActive,
    getPeerChatRouteId, getChannelChatRouteId,
    openChat, openCreateChannel,
  }
}
