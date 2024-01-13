<template>
  <md-dialog>
    <div slot="headline">
      {{ title }}
    </div>
    <div slot="content">
      <md-outlined-text-field ref="inputRef" class="form-control" :error="valueError" :error-text="valueError ? $t(valueError) : ''" v-model="inputValue" @keyup.enter="doAction" />
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="ok" @click="doAction" autofocus>
        {{ $t('ok') }}
      </md-filled-button>
    </div>
  </md-dialog>
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
<style lang="scss" scoped>
md-dialog {
  --md-sys-color-surface-container-high: var(--md-sys-color-surface-variant);
}
</style>
