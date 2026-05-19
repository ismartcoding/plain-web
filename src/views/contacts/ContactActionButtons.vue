<template>
  <div class="actions">
    <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItem">
      <i-material-symbols:delete-forever-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('edit')" @click.stop="edit">
      <i-material-symbols:edit />
    </v-icon-button>
    <TagRelationsDropdown :type="dataType" :tags="tags" :item="{ key: item.id, title: '', size: 0 }" :selected="item.tags" />
  </div>
</template>

<script setup lang="ts">
import type { IContact, ITag } from '@/lib/interfaces'
import { DataType } from '@/lib/data'

interface Props {
  item: IContact
  tags: ITag[]
  dataType: DataType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleteItem: [item: IContact]
  edit: [item: IContact]
}>()

function deleteItem() {
  emit('deleteItem', props.item)
}

function edit() {
  emit('edit', props.item)
}
</script> 