<template>
  <md-dialog>
    <form id="form" slot="content" method="dialog">
      <div class="title">{{ $t('confirm_to_delete_name', { name: name }) }}</div>
      <div class="image"><img v-if="image" :src="getFileUrl(image, '&w=200&h=200')" alt="" class="image-thumb" onerror="this.style.display='none'" /></div>
    </form>
    <div slot="actions">
      <md-outlined-button form="form" value="cancel">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button form="form" value="delete" :disabled="loading" @click="doDelete" autofocus>{{ $t('delete') }}</md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import type { DocumentNode } from 'graphql'
import { initMutation } from '@/lib/api/mutation'
import type { ApolloCache } from '@apollo/client/core'
import { popModal } from './modal'
import { getFileUrl } from '@/lib/api/file'

const props = defineProps({
  id: { type: String, default: '', required: true },
  name: { type: String },
  image: { type: String },
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
<style lang="scss" scoped>
.title {
  font-size: 1rem;
  font-weight: bold;
  margin-bottom: 1rem;
}
.image {
  width: 100px;
  img {
    height: 100px;
  }
}
</style>
