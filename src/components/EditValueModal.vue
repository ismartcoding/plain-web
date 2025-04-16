<template>
  <md-dialog>
    <div slot="headline">
      {{ title }}
    </div>
    <div slot="content">
      <md-outlined-text-field ref="inputRef" v-model="name" :placeholder="placeholder" :error="errors.name" :error-text="errors.name ? $t(errors.name) : ''" @keyup.enter="doAction" />
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="cancel">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="loading" autofocus @click="doAction"><md-circular-progress v-if="loading" slot="icon" indeterminate />{{ $t('save') }} </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { onMounted, ref, type PropType } from 'vue'
import * as yup from 'yup'
import type { OperationVariables } from '@apollo/client/core'
import { popModal } from './modal'

const inputRef = ref<HTMLInputElement>()

const props = defineProps({
  getVariables: {
    type: Function as PropType<(value: string) => OperationVariables>,
    required: true,
  },
  title: { type: String, required: true },
  placeholder: { type: String },
  value: { type: String },
  mutation: { type: Function, required: true },
  done: {
    type: Function as PropType<(value: string) => void>,
  },
})

const { errors, handleSubmit, defineField } = useForm({
  validationSchema: yup.object({
    name: yup.string().required(),
  }),
  initialValues: {
    name: props.value ?? '',
  },
})
const [name] = defineField('name')

const { mutate, loading, onDone } = props.mutation()
name.value = props.value ?? ''

function cancel() {
  popModal()
}

onMounted(async () => {
  setTimeout(() => {
    inputRef.value?.focus()
  }, 100)
})

const doAction = handleSubmit(() => {
  mutate(props.getVariables(name.value ?? ''))
})

onDone(() => {
  props.done?.call(this, name.value!)
  popModal()
})
</script>
<style scoped lang="scss">
md-outlined-text-field {
  width: 100%;
}
</style>
