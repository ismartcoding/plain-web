<template>
  <v-modal @close="popModal">
    <template #headline>
      {{ title }}
    </template>
    <template #content>
      <v-text-field ref="inputRef" v-model="inputValue" class="form-control" :error="!!valueError" :error-text="valueError ? $t(valueError) : ''" @keyup.enter="doAction" />
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="ok" @click="doAction">
        {{ $t('ok') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { nextTick, ref, type PropType, onMounted } from 'vue'
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
  value: { type: String, default: '' },
})

const { value: inputValue, resetField, errorMessage: valueError } = useField('inputValue', string().required())
const doAction = handleSubmit(() => {
  props.do(String(inputValue.value || ''))
  popModal()
})

if (props.value) {
  inputValue.value = props.value
} else {
  resetField()
}

// Focus management
onMounted(async () => {
  await nextTick()
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur()
        }
        inputRef.value?.focus()
      } catch (error) {
        console.debug('Focus blocked:', error)
      }
    }, 100)
  })
})
</script>
