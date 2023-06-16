<template>
  <v-modal title="ChatGPT">
    <template #body>
      <div class="row">
        <label class="col-md-2 col-form-label">{{ $t('api_key') }}</label>
        <div class="col-md-10">
          <input
            ref="input"
            type="text"
            :placeholder="$t('api_key')"
            class="form-control"
            v-model="inputValue"
            @keyup.enter="doAction"
          />
          <div class="invalid-feedback" v-show="valueError">
            {{ valueError ? $t(valueError) : '' }}
          </div>
        </div>
      </div>
    </template>
    <template #action>
      <button type="button" :disabled="loading" class="btn" @click="doAction">
        {{ $t('save') }}
      </button>
    </template>
  </v-modal>
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
const { value: inputValue, resetField, errorMessage: valueError } = useField('inputValue', string().required())
inputValue.value = props.value ?? ''
if (!inputValue.value) {
  resetField()
}

initQuery({
  handle: (data: any, error: string) => {
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
