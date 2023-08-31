<template>
  <md-dialog>
    <div slot="headline">
      {{ $t('update_subscription') }}
    </div>
    <div slot="content">
      <div class="form-label">
        {{ data?.url }}
      </div>
      <div class="form-row">
        <md-outlined-text-field
          ref="input"
          class="form-control"
          :label="$t('name')"
          :error="valueError"
          :error-text="valueError ? $t(valueError) : ''"
          v-model="inputValue"
          @keyup.enter="doAction"
        />
      </div>
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="loading" @click="doAction" autofocus>
        {{ $t('save') }}
      </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { initMutation, updateFeedGQL } from '@/lib/api/mutation'
import type { IFeed } from '@/lib/interfaces'
import { useField, useForm } from 'vee-validate'
import { nextTick, ref, type PropType } from 'vue'
import { string } from 'yup'
import { popModal } from './modal'

const { handleSubmit } = useForm()

const input = ref<HTMLInputElement>()

const props = defineProps({
  data: {
    type: Object as PropType<IFeed>,
  },
})

const { mutate, loading, onDone } = initMutation({
  document: updateFeedGQL,
  appApi: true,
})
const { value: inputValue, errorMessage: valueError } = useField('inputValue', string().required())
inputValue.value = props.data?.name ?? ''
;(async () => {
  await nextTick()
  input.value?.focus()
})()

const doAction = handleSubmit(() => {
  mutate({ id: props.data?.id, name: inputValue.value })
})

onDone(() => {
  popModal()
})
</script>
