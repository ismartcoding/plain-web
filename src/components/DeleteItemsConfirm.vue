<template>
  <v-modal class="delete-modal" :title="$t('confirm_to_delete')">
    <template #action>
      <button type="button" :disabled="loading" class="btn" @click="doDelete">{{ $t('delete') }}</button>
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
  appApi: true,
})

function doDelete() {
  mutate(props.variables())
}

onDone(() => {
  props.done()
  popModal()
})
</script>
