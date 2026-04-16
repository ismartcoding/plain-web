<template>
  <div class="actions">
    <v-icon-button v-tooltip="$t('delete')" @click.stop="deleteItem">
      <i-material-symbols:delete-forever-outline-rounded />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('edit')" @click.stop="edit">
      <i-material-symbols:edit />
    </v-icon-button>
    <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="addItemToTags">
      <i-material-symbols:label-outline-rounded />
    </v-icon-button>
  </div>
</template>

<script setup lang="ts">
import type { IContact } from '@/lib/interfaces'

interface Props {
  item: IContact
}

const props = defineProps<Props>()

const emit = defineEmits<{
  deleteItem: [item: IContact]
  edit: [item: IContact]
  addItemToTags: [item: IContact]
}>()

function deleteItem() {
  emit('deleteItem', props.item)
}

function edit() {
  emit('edit', props.item)
}

function addItemToTags() {
  emit('addItemToTags', props.item)
}
</script> 