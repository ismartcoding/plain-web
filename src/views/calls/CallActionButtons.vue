<template>
  <div class="actions">
    <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItem">
      <i-material-symbols:delete-forever-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('make_a_phone_call')" :loading="callLoading && callId === item.id" @click.stop="call">
      <i-material-symbols:call-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addItemToTags">
      <i-material-symbols:label-outline-rounded />
    </v-icon-button>
  </div>
</template>

<script setup lang="ts">
import type { ICall } from '@/lib/interfaces'

interface Props {
  item: ICall
  callLoading?: boolean
  callId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleteItem: [item: ICall]
  call: [item: ICall]
  addItemToTags: [item: ICall]
}>()

function deleteItem() {
  emit('deleteItem', props.item)
}

function call() {
  emit('call', props.item)
}

function addItemToTags() {
  emit('addItemToTags', props.item)
}
</script> 