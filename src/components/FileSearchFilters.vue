<template>
  <v-chip-set v-if="filter.text || filter.showHidden">
    <v-input-chip v-if="filter.text" key="filter-text" :label="filter.text" remove-only @remove="removeText" />
    <v-input-chip v-if="filter.showHidden" key="filter-show-hidden" :label="$t('show_hidden')" remove-only @remove="removeShowHidden">
      <i-material-symbols:hide-source-outline-rounded />
    </v-input-chip>
  </v-chip-set>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import type { IFileFilter } from '@/lib/interfaces'

const props = defineProps({
  filter: {
    type: Object as PropType<IFileFilter>,
    required: true,
  },
})

const emit = defineEmits<{
  filterChange: [filter: IFileFilter]
}>()

function removeText() {
  const newFilter = { ...props.filter }
  newFilter.text = ''
  emit('filterChange', newFilter)
}

function removeShowHidden() {
  const newFilter = { ...props.filter }
  newFilter.showHidden = false
  emit('filterChange', newFilter)
}
</script> 