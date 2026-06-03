<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <PeerListItem
          kind="local"
          :active="currentChatId === 'local'"
          :title="$t('page_title.local_chat')"
          :subtitle="getLatestChatPreview('local')"
          :time="getLatestChatCreatedAt('local')"
          @click="openChat('local')"
        >
        </PeerListItem>
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
          <PeerListItem
            v-for="channel in joinedChannels"
            :key="channel.id"
            kind="channel"
            :active="isChannelActive(channel.id)"
            :title="channel.name"
            :subtitle="getLatestChatPreview(`channel:${channel.id}`)"
            :time="getLatestChatCreatedAt(`channel:${channel.id}`)"
            @click="openChat(getChannelChatRouteId(channel.id))"
          />
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
              v-for="peer in allPeers"
              :key="peer.id"
              kind="peer"
              :device-type="peer.deviceType"
              :online="!!peer.online"
              :active="isPeerActive(peer.id)"
              :title="peer.name"
              :subtitle="getLatestChatPreview(`peer:${peer.id}`) || peer.ip"
              :time="getLatestChatCreatedAt(`peer:${peer.id}`)"
              @click="openChat(getPeerChatRouteId(peer.id))"
            />
          </ul>
        </template>
      </template>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { useChatSidebar } from './hooks/chat-sidebar'
import { isLocalMode } from '@/lib/local-mode'
import { openModal } from '@/components/modal'
import NearbyModal from '@/views/chat/NearbyModal.vue'
import PeerListItem from './components/PeerListItem.vue'

const {
  currentChatId, loading,
  allPeers, joinedChannels,
  isPeerActive, isChannelActive,
  getPeerChatRouteId, getChannelChatRouteId,
  getLatestChatPreview, getLatestChatCreatedAt,
  openChat, openCreateChannel, onPeerPaired,
} = useChatSidebar()

function openNearby() {
  openModal(NearbyModal, { onPaired: onPeerPaired })
}

</script>

<style lang="scss" scoped>
.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}
</style>
