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
v-if="isOwner && member.id !== selfId" v-tooltip="$t('remove_member')" class="sm"
            @click="removeMember(member.id)">
            <i-material-symbols:close-rounded />
          </v-icon-button>
        </li>
      </ul>

      <template v-if="isOwner && availablePeers.length > 0">
        <div class="chat-section-label">{{ $t('add_member') }}</div>
        <ul class="card chat-member-list">
          <li
v-for="peer in availablePeers" :key="peer.id" class="chat-member-item clickable"
            @click="addMember(peer.id)">
            <div class="chat-member-main">
              <span class="chat-member-name">{{ peer.name }}</span>
              <span class="chat-secondary-text">{{ peer.ip }}</span>
            </div>
          </li>
        </ul>
      </template>
    </template>
    <template #actions>
      <v-outlined-button @click="close">{{ $t('close') }}</v-outlined-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PropType } from 'vue'
import type { IChatChannel, IPeer } from '@/lib/interfaces'
import { popModal } from '@/components/modal'
import { initMutation, addChatChannelMemberGQL, removeChatChannelMemberGQL } from '@/lib/api/mutation'

const props = defineProps({
  channel: { type: Object as PropType<IChatChannel>, required: true },
  peers: { type: Array as PropType<IPeer[]>, default: () => [] },
  selfId: { type: String, default: '' },
  onRenamed: { type: Function as PropType<(channel: IChatChannel) => void>, default: undefined },
  onMemberUpdated: { type: Function as PropType<() => void>, default: () => { } },
})

const channel = ref({ ...props.channel })
const isOwner = computed(() => channel.value.owner === 'me')
const memberIds = computed(() => new Set(channel.value.members.map((m) => m.id)))
const availablePeers = computed(() => props.peers.filter((p) => p.status === 'paired' && !memberIds.value.has(p.id)))

function getMemberName(peerId: string) {
  if (peerId === props.selfId) return 'Me'
  return props.peers.find((p) => p.id === peerId)?.name ?? peerId.substring(0, 8)
}

function getOwnerName() {
  return props.peers.find((p) => p.id === channel.value.owner)?.name ?? channel.value.owner.substring(0, 8)
}

const { mutate: mutateAddMember, onDone: onAddMemberDone } = initMutation({ document: addChatChannelMemberGQL })
const { mutate: mutateRemoveMember, onDone: onRemoveMemberDone } = initMutation({ document: removeChatChannelMemberGQL })

onAddMemberDone((r: any) => { if (r.data?.addChatChannelMember) channel.value = { ...r.data.addChatChannelMember }; props.onMemberUpdated() })
onRemoveMemberDone((r: any) => { if (r.data?.removeChatChannelMember) channel.value = { ...r.data.removeChatChannelMember }; props.onMemberUpdated() })

function addMember(peerId: string) { mutateAddMember({ id: channel.value.id, peerId }) }
function removeMember(peerId: string) { mutateRemoveMember({ id: channel.value.id, peerId }) }
function close() { popModal() }
</script>
