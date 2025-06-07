<template>
  <v-modal @close="popModal">
    <template #content>
      {{ $t('confirm_to_delete', { count }) }}
    </template>
    <template #actions>
      <v-outlined-button @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button :disabled="loading" @click="doDelete">{{ $t('delete') }}</v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { initMutation } from '@/lib/api/mutation'
import { popModal } from './modal'
import type { PropType } from 'vue'
import type { DocumentNode } from 'graphql'

const props = defineProps({
  gql: { type: Object as PropType<DocumentNode>, required: true },
  count: { type: Number, required: true },
  done: {
    type: Function as PropType<() => void>,
    required: true,
  },
  variables: {
    type: Function as PropType<() => any>,
    required: true,
  },
})

const { mutate, loading, onDone } = initMutation({
  document: props.gql,
})

function doDelete() {
  mutate(props.variables())
}

onDone(() => {
  props.done()
  popModal()
})
</script>
