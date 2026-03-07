<template>
  <v-modal @close="close">
    <template #headline>{{ $t('channel_invite') }}</template>
    <template #content>
      <p>{{ $t('channel_invite_desc', { name: channel.name }) }}</p>
      <section class="card chat-detail-card">
        <div class="key-value">
          <span class="key">{{ $t('channel_name') }}</span>
          <span class="value">{{ channel.name }}</span>
        </div>
        <div class="key-value">
          <span class="key">{{ $t('channel_members') }}</span>
          <span class="value">{{ channel.members.length }}</span>
        </div>
      </section>
    </template>
    <template #actions>
      <v-outlined-button :loading="declineLoading" @click="decline">{{ $t('decline_invite') }}</v-outlined-button>
      <v-filled-button :loading="acceptLoading" @click="accept">{{ $t('accept_invite') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { popModal } from '@/components/modal'
import { initMutation, acceptChatChannelInviteGQL, declineChatChannelInviteGQL } from '@/lib/api/mutation'
import type { IChatChannel } from '@/lib/interfaces'

const props = defineProps({
  channel: { type: Object as PropType<IChatChannel>, required: true },
})

const emit = defineEmits<{
  (e: 'accepted'): void
  (e: 'declined'): void
}>()

const { mutate: mutateAccept, loading: acceptLoading, onDone: onAcceptDone } = initMutation({
  document: acceptChatChannelInviteGQL,
})

const { mutate: mutateDecline, loading: declineLoading, onDone: onDeclineDone } = initMutation({
  document: declineChatChannelInviteGQL,
})

onAcceptDone(() => {
  emit('accepted')
  popModal()
})

onDeclineDone(() => {
  emit('declined')
  popModal()
})

function accept() {
  mutateAccept({ id: props.channel.id })
}

function decline() {
  mutateDecline({ id: props.channel.id })
}

function close() {
  popModal()
}
</script>
