<template>
  <v-modal @close="dismiss">
    <template #headline>{{ $t('channel_invite') }}</template>
    <template #content>
      <p class="desc">
        {{ $t('channel_invite_desc', { name: invite.channelName }) }}
      </p>
      <p v-if="invite.fromName" class="from">
        {{ $t('from') }}: <strong>{{ invite.fromName }}</strong>
      </p>
    </template>
    <template #actions>
      <v-outlined-button :loading="loading" :disabled="loading" @click="respond(false)">
        {{ $t('decline_invite') }}
      </v-outlined-button>
      <v-filled-button :loading="loading" :disabled="loading" @click="respond(true)">
        {{ $t('accept_invite') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { popModal } from '@/components/modal'
import { initMutation, respondChannelInviteGQL } from '@/lib/api/mutation'

interface IChannelInvite {
  channelId: string
  channelName: string
  fromId: string
  fromName: string
}

const props = defineProps<{
  invite: IChannelInvite
  onResponded?: (channelId: string, accepted: boolean) => void
}>()

const loading = ref(false)

const { mutate, onDone, onError } = initMutation({ document: respondChannelInviteGQL })

onDone((r: any) => {
  const accepted = !!r.data?.respondChannelInvite
  props.onResponded?.(props.invite.channelId, accepted)
  popModal()
})

onError(() => {
  // Surface the error to the user but keep the modal closed so they can
  // retry by re-opening the chat view (the channel is persisted locally).
  popModal()
})

async function respond(accept: boolean) {
  if (loading.value) return
  loading.value = true
  try {
    mutate({ id: props.invite.channelId, accept })
  } catch (e) {
    loading.value = false
    throw e
  }
}

function dismiss() {
  // Dismiss without responding — treat as a temporary deferral. The channel
  // remains in the local list; the user can re-open it from the sidebar
  // and respond later (no GraphQL call).
  popModal()
}
</script>

<style scoped>
.desc {
  margin: 0 0 8px 0;
  line-height: 1.4;
}
.from {
  margin: 0;
  font-size: 13px;
  opacity: 0.75;
}
</style>
