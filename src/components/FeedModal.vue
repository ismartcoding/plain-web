<template>
  <v-modal :title="$t('update_subscription')">
    <template #body>
      <div class="mb-4">
        {{ data?.url }}
      </div>
      <div>
        <input
          ref="input"
          type="text"
          :placeholder="$t('name')"
          class="form-control"
          v-model="inputValue"
          @keyup.enter="doAction"
        />
        <div class="invalid-feedback" v-show="valueError">
          {{ valueError ? $t(valueError) : '' }}
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
