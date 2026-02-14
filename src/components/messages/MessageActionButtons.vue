<template>
  <div class="actions">
    <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addItemToTags">
      <i-material-symbols:label-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('send_sms')" @click.stop="sendSms">
      <i-material-symbols:sms-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('make_a_phone_call')" :loading="callLoading && callId === item.id" @click.stop="call">
      <i-material-symbols:call-outline-rounded />
    </v-icon-button>
  </div>
</template>

<script setup lang="ts">
import type { IMessage } from '@/lib/interfaces'

interface Props {
  item: IMessage
  callLoading?: boolean
  callId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  addItemToTags: [item: IMessage]
  sendSms: [item: IMessage]
  call: [item: IMessage]
}>()

function addItemToTags() {
  emit('addItemToTags', props.item)
}

function call() {
  emit('call', props.item)
}

function sendSms() {
  emit('sendSms', props.item)
}
</script> 