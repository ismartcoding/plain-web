<template>
  <md-dialog>
    <div slot="headline">ChatGPT</div>
    <div slot="content">
      <md-outlined-text-field ref="input" :label="$t('api_key')" class="form-control" v-model="inputValue" @keyup.enter="doAction" :error="valueError" :error-text="valueError ? $t(valueError) : ''" />
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="loading" @click="doAction" autofocus> <md-circular-progress indeterminate v-if="loading" slot="icon" /> {{ $t('save') }} </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { nextTick, ref } from 'vue'
import { string } from 'yup'
import { popModal } from './modal'
import { initMutation, updateAIChatConfigGQL } from '@/lib/api/mutation'
import { aiChatConfigGQL, initQuery } from '@/lib/api/query'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import type { IAIChatConfig } from '@/lib/interfaces'

const { handleSubmit } = useForm()

const input = ref<HTMLInputElement>()
const { t } = useI18n()

const props = defineProps({
  value: { type: String },
})

const { mutate, loading, onDone } = initMutation({
  document: updateAIChatConfigGQL,
  options: {
    update: () => {},
  },
  appApi: true,
})
const { value: inputValue, resetField, errorMessage: valueError } = useField('inputValue', string())
inputValue.value = props.value ?? ''
if (!inputValue.value) {
  resetField()
}

initQuery({
  handle: (data: { aiChatConfig: IAIChatConfig }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        inputValue.value = data.aiChatConfig.chatGPTApiKey
      }
    }
  },
  document: aiChatConfigGQL,
  variables: null,
  appApi: true,
})
;(async () => {
  await nextTick()
  input.value?.focus()
})()

const doAction = handleSubmit(() => {
  mutate({ chatGPTApiKey: inputValue.value ?? '' })
})

onDone(() => {
  popModal()
})
</script>
