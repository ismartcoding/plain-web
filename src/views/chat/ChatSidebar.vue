<template>
  <left-sidebar>
    <template #body>
      <ul class="nav">
        <li :class="{ active: currentChatId === 'local' }" @click.prevent="openChat('local')">
          <span class="icon" aria-hidden="true"><i-lucide:bot /></span>
          <span class="title">{{ $t('page_title.local_chat') }}</span>
        </li>
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
          <li
            v-for="channel in joinedChannels"
            :key="channel.id"
            :class="{ active: isChannelActive(channel.id) }"
            @click.prevent="openChat(getChannelChatRouteId(channel.id))"
          >
            <span class="icon" aria-hidden="true"><i-lucide:hash /></span>
            <span class="title">{{ channel.name }}</span>
          </li>
        </ul>

        <template v-if="pairedPeers.length > 0">
          <div class="section-title">{{ $t('paired_devices') }}</div>
          <ul class="nav">
            <li
              v-for="peer in pairedPeers"
              :key="peer.id"
              :class="{ active: isPeerActive(peer.id) }"
              @click.prevent="openChat(getPeerChatRouteId(peer.id))"
            >
              <span class="icon" aria-hidden="true">
                <i-lucide:smartphone v-if="peer.deviceType === 'phone'" />
                <i-lucide:tablet v-else-if="peer.deviceType === 'tablet'" />
                <i-lucide:laptop v-else-if="peer.deviceType === 'pc'" />
                <i-lucide:monitor v-else />
              </span>
              <span class="title">{{ peer.name }}</span>
            </li>
          </ul>
        </template>

        <template v-if="unpairedPeers.length > 0">
          <div class="section-title">{{ $t('unpaired_devices') }}</div>
          <ul class="nav">
            <li
              v-for="peer in unpairedPeers"
              :key="peer.id"
              :class="{ active: isPeerActive(peer.id) }"
              @click.prevent="openChat(getPeerChatRouteId(peer.id))"
            >
              <span class="icon" aria-hidden="true">
                <i-lucide:smartphone v-if="peer.deviceType === 'phone'" />
                <i-lucide:tablet v-else-if="peer.deviceType === 'tablet'" />
                <i-lucide:laptop v-else-if="peer.deviceType === 'pc'" />
                <i-lucide:monitor v-else />
              </span>
              <span class="title">{{ peer.name }}</span>
              <span class="subtitle">{{ peer.ip }}</span>
            </li>
          </ul>
        </template>
      </template>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { useChatSidebar } from './hooks/chat-sidebar'

const {
  currentChatId, loading,
  pairedPeers, unpairedPeers, joinedChannels,
  isPeerActive, isChannelActive,
  getPeerChatRouteId, getChannelChatRouteId,
  openChat, openCreateChannel,
} = useChatSidebar()
</script>

<style lang="scss" scoped>
.sidebar-loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}
</style>
