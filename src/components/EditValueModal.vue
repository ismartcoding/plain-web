<template>
  <md-dialog>
    <div slot="headline">
      {{ title }}
    </div>
    <div slot="content">
      <md-outlined-text-field
        ref="inputRef"
        :placeholder="placeholder"
        v-model="inputValue"
        @keyup.enter="doAction"
        :error="valueError"
        :error-text="valueError ? $t(valueError) : ''"
      />
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="cancel">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="loading" @click="doAction" autofocus>
        {{ $t('save') }}
      </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { nextTick, ref, type PropType } from 'vue'
import { string } from 'yup'
import type { OperationVariables } from '@apollo/client/core'
import { popModal } from './modal'

const { handleSubmit } = useForm()

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

const { mutate, loading, onDone } = props.mutation()
const { value: inputValue, resetField, errorMessage: valueError } = useField('inputValue', string().required())
inputValue.value = props.value ?? ''
if (!inputValue.value) {
  resetField()
}

function cancel() {
  popModal()
}

;(async () => {
  await nextTick()
  inputRef.value?.focus()
})()

const doAction = handleSubmit(() => {
  mutate(props.getVariables(inputValue.value ?? ''))
})

onDone(() => {
  props.done?.call(this, inputValue.value!)
  popModal()
})
</script>
<style scoped lang="scss">
md-outlined-text-field {
  width: 100%;
}
</style>
