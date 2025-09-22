<template>
  <v-modal @close="popModal">
    <template #content>
      <div class="title">{{ $t('confirm_to_delete_name', { name: name }) }}</div>
      <div class="image"><img v-if="image" :src="getFileUrl(image, '&w=200&h=200')" alt="" class="image-thumb" onerror="this.style.display='none'" /></div>
    </template>
    <template #actions>
      <v-outlined-button @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button :loading="loading" @click="doDelete">{{ $t('delete') }}</v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import type { DocumentNode } from 'graphql'
import { initMutation } from '@/lib/api/mutation'
import type { ApolloCache } from '@apollo/client/core'
import { popModal } from './modal'
import { getFileUrl } from '@/lib/api/file'

const props = defineProps({
  id: { type: String, required: true },
  name: { type: String, default: '' },
  image: { type: String, default: '' },
  gql: { type: Object as PropType<DocumentNode>, required: true },
  typeName: { type: String, required: true },
  done: {
    type: Function as PropType<() => void>,
    default: () => {},
  },
  variables: {
    type: Function as PropType<() => any>,
    default: undefined,
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
