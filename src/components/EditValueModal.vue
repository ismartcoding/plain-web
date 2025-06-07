<template>
  <v-modal @close="cancel">
    <template #headline>
      {{ title }}
    </template>
    <template #content>
      <v-text-field ref="inputRef" v-model="name" :placeholder="placeholder" :error="!!errors.name" :error-text="errors.name ? $t(errors.name) : ''" @keyup.enter="doAction" />
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="cancel">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="save" :disabled="loading" @click="doAction">
        <v-circular-progress v-if="loading" slot="icon" indeterminate />
        {{ $t('save') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { onMounted, ref, type PropType, nextTick } from 'vue'
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
  placeholder: { type: String, default: '' },
  value: { type: String, default: '' },
  mutation: { type: Function, required: true },
  done: {
    type: Function as PropType<(value: string) => void>,
    default: () => {},
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
  await nextTick()
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        // Blur current focused element and focus input
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

const doAction = handleSubmit(() => {
  mutate(props.getVariables(name.value ?? ''))
})

onDone(() => {
  props.done?.call(this, name.value!)
  popModal()
})
</script>
<style scoped lang="scss">
:deep(.form-control) {
  width: 100%;
}
</style>
