<template>
  <v-modal :title="title">
    <template #body>
      <input ref="inputRef" type="text" class="form-control" v-model="inputValue" @keyup.enter="doAction" />
      <div class="invalid-feedback" v-show="valueError">
        {{ valueError ? $t(valueError) : '' }}
      </div>
    </template>
    <template #action>
      <button type="button" class="btn" @click="doAction">
        {{ $t('ok') }}
      </button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { nextTick, ref, type PropType } from 'vue'
import { string } from 'yup'
import { popModal } from './modal'

const { handleSubmit } = useForm()

const inputRef = ref<HTMLInputElement>()

const props = defineProps({
  do: {
    type: Function as PropType<(value: string) => void>,
    required: true,
  },
  title: { type: String, required: true },
  value: { type: String },
})

const { value: inputValue, resetField, errorMessage: valueError } = useField('inputValue', string().required())
const doAction = handleSubmit(() => {
  props.do(inputValue.value ?? '')
  popModal()
})

inputValue.value = props.value
if (!props.value) {
  resetField()
}

;(async () => {
  await nextTick()
  inputRef.value?.focus()
})()
</script>
