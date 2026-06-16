<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
<LocalListItem
          :active="currentChatId === 'peer:local'" :title="$t('page_title.local_chat')"
          :subtitle="getLatestChatPreview('peer:local')" :time="getLatestChatCreatedAt('peer:local')"
          @click="openChat('peer:local')" />
      </ul>

      <template v-if="loading">
        <div class="sidebar-loading">
          <v-circular-progress indeterminate class="sm" />
        </div>
      </template>
      <template v-else>
        <div class="section-title">
          {{ $t('channels') }}
          <v-icon-button v-tooltip="$t('create_channel')" class="sm" @click="openCreateChannel">
            <i-material-symbols:add-rounded />
          </v-icon-button>
        </div>
        <ul class="nav">
          <ChannelListItem
v-for="channel in joinedChannels" :key="channel.id" :channel="channel"
            :active="isChannelActive(channel.id)" :subtitle="getLatestChatPreview(`channel:${channel.id}`)"
            :time="getLatestChatCreatedAt(`channel:${channel.id}`)"
            @click="openChat(getChannelChatRouteId(channel.id))"
            @info="openInfo(`channel:${channel.id}`)" />
        </ul>

        <template v-if="allPeers.length > 0 || isLocalMode()">
          <div class="section-title">
            {{ $t('devices') }}
            <v-icon-button v-if="isLocalMode()" v-tooltip="$t('discover_devices')" class="sm" @click="openNearby">
              <i-lucide:radar />
            </v-icon-button>
          </div>
          <ul class="nav">
            <PeerListItem
v-for="peer in allPeers" :key="peer.id" :peer="peer" :active="isPeerActive(peer.id)"
              :online="!!peer.online" :subtitle="getLatestChatPreview(`peer:${peer.id}`) || peer.ip"
              :time="getLatestChatCreatedAt(`peer:${peer.id}`)" @click="openChat(getPeerChatRouteId(peer.id))"
              @info="openInfo(`peer:${peer.id}`)" />
          </ul>
        </template>
      </template>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { openModal } from '@/components/modal'
import { isLocalMode } from '@/lib/local-mode'
import { getFileId } from '@/lib/api/file'
import { replacePath } from '@/plugins/router'
import { decryptChatId } from './hooks/chat-route'
import { useChatStore } from '@/stores/chat'
import { useMainStore } from '@/stores/main'
import { useTempStore } from '@/stores/temp'
import ChannelListItem from './components/ChannelListItem.vue'
import PeerListItem from './components/PeerListItem.vue'
import LocalListItem from './components/LocalListItem.vue'
import CreateChannelModal from './CreateChannelModal.vue'
import NearbyModal from './NearbyModal.vue'
import PeerInfoModal from './PeerInfoModal.vue'
import ChannelInfoModal from './ChannelInfoModal.vue'

const router = useRouter()
const mainStore = useMainStore()
const { urlTokenKey } = storeToRefs(useTempStore())
const chatStore = useChatStore()
const { loading, allPeers, joinedChannels, peers } = storeToRefs(chatStore)

const currentChatId = computed(() => {
  if (router.currentRoute.value.path.includes('app-files')) return ''
  const qid = router.currentRoute.value.query.id
  const enc = typeof qid === 'string' && qid !== '' ? qid : ''
  return decryptChatId(enc, urlTokenKey.value)
})

function isPeerActive(peerId: string) {
  return currentChatId.value === `peer:${peerId}`
}

function isChannelActive(channelId: string) {
  return currentChatId.value === `channel:${channelId}`
}

function getPeerChatRouteId(peerId: string) {
  return getFileId(urlTokenKey.value, `peer:${peerId}`)
}

function getChannelChatRouteId(channelId: string) {
  return getFileId(urlTokenKey.value, `channel:${channelId}`)
}

function openChat(id: string) {
  if (id === 'peer:local') {
    replacePath(mainStore, '/chat')
    return
  }
  replacePath(mainStore, `/chat?id=${encodeURIComponent(id)}`)
}

function openInfo(targetChatId: string) {
  if (targetChatId.startsWith('peer:')) {
    const peerId = targetChatId.slice(5)
    openModal(PeerInfoModal, {
      peer: peerId ? chatStore.findPeer(peerId) : null,
    })
  } else if (targetChatId.startsWith('channel:')) {
    const channelId = targetChatId.slice(8)
    const channel = chatStore.findChannel(channelId)
    if (!channel) return
    openModal(ChannelInfoModal, {
      channel,
      peers: peers.value,
      selfId: '',
      onMemberUpdated: () => chatStore.fetchChannels(),
    })
  }
}

function getLatestChatPreview(chatId: string) {
  return chatStore.getLatestChatPreview(chatId)
}

function getLatestChatCreatedAt(chatId: string) {
  return chatStore.getLatestChatCreatedAt(chatId)
}

function openCreateChannel() {
  openModal(CreateChannelModal)
}

async function openNearby() {
  openModal(NearbyModal, {
    onPaired: async (peerId: string) => {
      await chatStore.fetchPeers()
      openChat(getPeerChatRouteId(peerId))
    },
  })
}

onMounted(() => { chatStore.init() })
</script>

<style lang="scss" scoped>
.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}
</style>