<template>
  <div class="actions">
    <TagRelationsDropdown :type="dataType" :tags="tags" :item="{ key: item.id, title: '', size: 0 }" :selected="item.tags ?? []" />
    <v-icon-button v-tooltip="$t('send_sms')" @click.stop="sendSms">
      <i-material-symbols:sms-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('make_a_phone_call')" :loading="callLoading && callId === item.id" @click.stop="call">
      <i-material-symbols:call-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('archive_conversation')" @click.stop="archive">
      <i-material-symbols:archive-outline-rounded />
    </v-icon-button>
  </div>
</template>

<script setup lang="ts">
import type { IMessage, ITag } from '@/lib/interfaces'
import { DataType } from '@/lib/data'

interface Props {
  item: IMessage
  tags: ITag[]
  dataType: DataType
  callLoading?: boolean
  callId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  sendSms: [item: IMessage]
  call: [item: IMessage]
  archive: [item: IMessage]
}>()

function call() {
  emit('call', props.item)
}

function sendSms() {
  emit('sendSms', props.item)
}

function archive() {
  emit('archive', props.item)
}
</script> 