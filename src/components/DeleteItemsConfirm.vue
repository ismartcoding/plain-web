<template>
  <md-dialog>
    <form id="form" slot="content" method="dialog">
      {{ $t('confirm_to_delete', { count }) }}
    </form>
    <div slot="actions">
      <outlined-button form="form" value="cancel">{{ $t('cancel') }}</outlined-button>
      <filled-button form="form" value="delete" :disabled="loading" autofocus @click="doDelete">{{ $t('delete') }}</filled-button>
    </div>
  </md-dialog>
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
