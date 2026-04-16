<template>
  <v-modal @close="close">
    <template #headline>{{ $t('channel_info') }}</template>
    <template #content>
      <section class="card chat-detail-card">
        <div class="key-value">
          <span class="key">{{ $t('channel_name') }}</span>
          <span class="value">{{ channel.name }}</span>
        </div>
        <div class="key-value">
          <span class="key">{{ $t('owner') }}</span>
          <span class="value">{{ channel.owner === 'me' ? $t('me') : getOwnerName() }}</span>
        </div>
      </section>

      <div class="chat-section-label">{{ $t('channel_members') }} ({{ channel.members.length }})</div>
      <ul class="card chat-member-list">
        <li v-for="member in channel.members" :key="member.id" class="chat-member-item">
          <div class="chat-member-main">
            <span class="chat-member-name">{{ getMemberName(member.id) }}</span>
          </div>
          <span v-if="member.status === 'pending'" class="chat-status-badge pending">{{ $t('member_pending') }}</span>
          <span v-else class="chat-status-badge joined">{{ $t('member_joined') }}</span>
          <v-icon-button
            v-if="isOwner && member.id !== selfId"
            v-tooltip="$t('remove_member')"
            class="sm"
            @click="removeMember(member.id)"
          >
            <i-material-symbols:close-rounded />
          </v-icon-button>
        </li>
      </ul>

      <template v-if="isOwner && availablePeers.length > 0">
        <div class="chat-section-label">{{ $t('add_member') }}</div>
        <ul class="card chat-member-list">
          <li v-for="peer in availablePeers" :key="peer.id" class="chat-member-item clickable" @click="addMember(peer.id)">
            <div class="chat-member-main">
              <span class="chat-member-name">{{ peer.name }}</span>
              <span class="chat-secondary-text">{{ peer.ip }}</span>
            </div>
          </li>
        </ul>
      </template>

      <div v-if="confirmAction" class="chat-confirm-block">
        <i-material-symbols:warning-outline-rounded class="chat-confirm-icon" />
        <p class="chat-confirm-text">
          {{ confirmAction === 'delete' ? $t('delete_channel_confirm') : confirmAction === 'leave' ? $t('leave_channel_confirm') : $t('clear_messages_confirm') }}
        </p>
      </div>
    </template>
    <template #actions>
      <template v-if="confirmAction">
        <v-outlined-button @click="confirmAction = ''">{{ $t('cancel') }}</v-outlined-button>
        <v-filled-button :loading="actionLoading" @click="doConfirmedAction">
          {{ confirmAction === 'delete' ? $t('delete_channel') : confirmAction === 'leave' ? $t('leave_channel') : $t('clear_messages') }}
        </v-filled-button>
      </template>
      <template v-else>
        <v-outlined-button @click="close">{{ $t('cancel') }}</v-outlined-button>
        <v-outlined-button v-if="isOwner" @click="openRename">{{ $t('rename_channel') }}</v-outlined-button>
        <v-outlined-button @click="confirmAction = 'clear'">{{ $t('clear_messages') }}</v-outlined-button>
        <v-outlined-button v-if="isOwner" @click="confirmAction = 'delete'">{{ $t('delete_channel') }}</v-outlined-button>
        <v-outlined-button v-else @click="confirmAction = 'leave'">{{ $t('leave_channel') }}</v-outlined-button>
      </template>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type { IChatChannel, IPeer } from '@/lib/interfaces'
import { useChannelInfo } from './hooks/channel-info'

const props = defineProps({
  channel: { type: Object as PropType<IChatChannel>, required: true },
  peers: { type: Array as PropType<IPeer[]>, default: () => [] },
  selfId: { type: String, default: '' },
  onClear: { type: Function as PropType<() => Promise<void>>, required: true },
  onDeleted: { type: Function as PropType<() => void>, default: () => {} },
  onMemberUpdated: { type: Function as PropType<() => void>, default: () => {} },
})

const {
  channel, confirmAction, actionLoading,
  isOwner, availablePeers,
  getMemberName, getOwnerName, doConfirmedAction,
  addMember, removeMember, openRename, close,
} = useChannelInfo(props)
</script>
