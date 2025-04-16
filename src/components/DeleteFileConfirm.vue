<template>
  <md-dialog>
    <form id="form" slot="content" method="dialog">
      {{ $t('confirm_to_delete_name', { name: truncate(files.map((it) => it.name).join(', '), { length: 200 }) }) }}
    </form>
    <div slot="actions">
      <md-outlined-button form="form" value="cancel">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button form="form" value="delete" :disabled="loading" autofocus @click="doDelete">
        <md-circular-progress v-if="loading" slot="icon" indeterminate />{{ $t('delete') }}
      </md-filled-button>
    </div>
  </md-dialog>
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

const {
  mutate,
  loading,
  onDone: onDeleteFilesDone,
} = initMutation({
  document: gql`
    mutation DeleteFiles($paths: [String!]!) {
      deleteFiles(paths: $paths)
    }
  `,
})

function doDelete() {
  mutate({ paths: props.files.map((it) => it.path) })
}

onDeleteFilesDone(() => {
  props.onDone(props.files)
  popModal()
})
</script>
