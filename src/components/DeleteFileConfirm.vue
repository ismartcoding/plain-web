<template>
  <v-modal class="delete-modal" :title="$t('confirm_to_delete_name', { name: file.name })">
    <template #action>
      <button type="button" :disabled="loading" class="btn" @click="doDelete">{{ $t('delete') }}</button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import gql from 'graphql-tag'
import type { PropType } from 'vue'
import type { IFile } from '@/lib/file'
import { initMutation } from '@/lib/api/mutation'
import { popModal } from './modal'

const props = defineProps({
  onDone: {
    type: Function as PropType<(file: IFile) => void>,
    required: true,
  },
  file: {
    type: Object as PropType<IFile>,
    required: true,
  },
})

const { mutate, loading, onDone } = initMutation({
  document: gql`
    mutation DeleteFiles($paths: [String!]!) {
      deleteFiles(paths: $paths)
    }
  `,
  appApi: true,
})

function doDelete() {
  mutate({ paths: [props.file.path] })
}

onDone(() => {
  props.onDone(props.file)
  popModal()
})
</script>
