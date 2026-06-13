<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <SidebarListItem
          :active="currentChatId === 'local'"
          :title="$t('page_title.local_chat')"
          :subtitle="getLatestChatPreview('local')"
          @click="openChat('local')"
        >
          <template #start>
            <span class="icon" aria-hidden="true">
              <i-lucide:bot />
            </span>
          </template>
          <template v-if="getLatestChatCreatedAt('local')" #end>
            <span v-tooltip="formatDateTime(getLatestChatCreatedAt('local'))" class="chat-time">
              {{ formatTimeAgo(getLatestChatCreatedAt('local')) }}
            </span>
          </template>
        </SidebarListItem>
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
            v-for="channel in joinedChannels"
            :key="channel.id"
            :channel="channel"
            :active="isChannelActive(channel.id)"
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
              :peer="peer"
              :active="isPeerActive(peer.id)"
              :online="!!peer.online"
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
import { useChatSidebar } from './hooks/chat-sidebar-base'
import { useChannelActions } from './hooks/channel-sidebar'
import { usePeerActions } from './hooks/peer-sidebar'
import { isLocalMode } from '@/lib/local-mode'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import ChannelListItem from './components/ChannelListItem.vue'
import PeerListItem from './components/PeerListItem.vue'

const sidebar = useChatSidebar()
const channels = useChannelActions({
  openChat: sidebar.openChat,
  getChannelChatRouteId: sidebar.getChannelChatRouteId,
})
const peers = usePeerActions({
  openChat: sidebar.openChat,
  getPeerChatRouteId: sidebar.getPeerChatRouteId,
})

const {
  currentChatId, loading,
  allPeers, joinedChannels,
  isPeerActive, isChannelActive,
  getPeerChatRouteId, getChannelChatRouteId,
  getLatestChatPreview, getLatestChatCreatedAt,
  openChat,
} = sidebar

const { openCreateChannel } = channels
const { openNearby } = peers
</script>

<style lang="scss" scoped>
.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}
</style>
