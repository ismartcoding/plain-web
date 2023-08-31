<template>
  <md-dialog>
    <form id="form" slot="content" method="dialog">
      {{ $t('confirm_to_delete_name', { name: name }) }}
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
import type { PropType } from 'vue'
import type { DocumentNode } from 'graphql'
import { initMutation } from '@/lib/api/mutation'
import type { ApolloCache } from '@apollo/client/core'
import { popModal } from './modal'

const props = defineProps({
  id: { type: String, default: '', required: true },
  name: { type: String },
  gql: { type: Object as PropType<DocumentNode>, required: true },
  typeName: { type: String, required: true },
  appApi: { type: Boolean, default: false },
  done: {
    type: Function as PropType<() => void>,
  },
  variables: {
    type: Function as PropType<() => any>,
  },
})

const { mutate, loading, onDone } = initMutation({
  document: props.gql,
  options: {
    update: (cache: ApolloCache<any>) => {
      if (props.typeName !== 'Application') {
        cache.evict({ id: cache.identify({ __typename: props.typeName, id: props.id }) })
      }
    },
  },
  appApi: props.appApi,
})

function doDelete() {
  mutate(props.variables ? props.variables() : { id: props.id })
}

onDone(() => {
  if (props.done) {
    props.done()
  }
  popModal()
})
</script>
