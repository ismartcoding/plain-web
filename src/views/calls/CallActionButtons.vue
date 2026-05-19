<template>
  <div class="actions">
    <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItem">
      <i-material-symbols:delete-forever-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('make_a_phone_call')" :loading="callLoading && callId === item.id" @click.stop="call">
      <i-material-symbols:call-outline-rounded />
    </v-icon-button>
    <TagRelationsDropdown :type="dataType" :tags="tags" :item="{ key: item.id, title: item.number, size: 0 }" :selected="item.tags" />
  </div>
</template>

<script setup lang="ts">
import type { ICall, ITag } from '@/lib/interfaces'
import { DataType } from '@/lib/data'

interface Props {
  item: ICall
  tags: ITag[]
  dataType: DataType
  callLoading?: boolean
  callId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleteItem: [item: ICall]
  call: [item: ICall]
}>()

function deleteItem() {
  emit('deleteItem', props.item)
}

function call() {
  emit('call', props.item)
}
</script> 