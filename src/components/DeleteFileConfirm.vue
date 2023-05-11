<template>
  <v-modal class="delete-modal"
    :title="$t('confirm_to_delete_name', { name: truncate(files.map(it => it.name).join(', '), { length: 200 }) })">
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
import { truncate } from 'lodash-es'

const props = defineProps({
  onDone: {
    type: Function as PropType<(file: IFile[]) => void>,
    required: true,
  },
  files: {
    type: Array as PropType<Array<IFile>>,
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
  mutate({ paths: props.files.map(it => it.path) })
}

onDone(() => {
  props.onDone(props.files)
  popModal()
})
</script>
