<template>
  <md-dialog>
    <form id="form" slot="content" method="dialog">
      {{ $t('confirm_to_delete') }}
    </form>
    <div slot="actions">
      <md-outlined-button form="form" value="cancel">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button form="form" value="delete" :disabled="loading" @click="doDelete" autofocus>{{
        $t('delete')
      }}</md-filled-button>
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
