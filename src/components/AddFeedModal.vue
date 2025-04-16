<template>
  <md-dialog>
    <div slot="headline">
      {{ $t('add_subscription') }}
    </div>
    <div slot="content">
      <div class="form-row">
        <md-outlined-text-field ref="inputRef" v-model="inputValue" :label="$t('rss_url')" :error="valueError" :error-text="valueError ? $t(valueError) : ''" @keyup.enter="doAction" />
      </div>
      <div class="form-row">
        <label class="form-check-label">
          <md-checkbox touch-target="wrapper" :checked="fetchContent" @change="toggleFetchContent" />
          {{ $t('fetch_content_automatically') }}
        </label>
      </div>
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="cancel">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="loading" autofocus @click="doAction"> <md-circular-progress v-if="loading" slot="icon" indeterminate /> {{ $t('save') }} </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { nextTick, ref, type PropType } from 'vue'
import { string } from 'yup'
import { popModal } from './modal'
import { createFeedGQL, initMutation } from '@/lib/api/mutation'
import type { MdCheckbox } from '@material/web/checkbox/checkbox'

const { handleSubmit } = useForm()

const inputRef = ref<HTMLInputElement>()
const fetchContent = ref(false)
function toggleFetchContent(e: Event) {
  fetchContent.value = (e.target as MdCheckbox).checked
}
const props = defineProps({
  done: {
    type: Function as PropType<() => void>,
  },
})

const { mutate, loading, onDone } = initMutation({
  document: createFeedGQL,
})
const { value: inputValue, resetField, errorMessage: valueError } = useField('inputValue', string().required())
resetField()

function cancel() {
  popModal()
}

;(async () => {
  await nextTick()
  inputRef.value?.focus()
})()

const doAction = handleSubmit(() => {
  mutate({ url: inputValue.value ?? '', fetchContent: fetchContent.value })
})

onDone(() => {
  props.done?.call(this)
  popModal()
})
</script>
<style scoped lang="scss">
md-outlined-text-field {
  width: 100%;
}
</style>
