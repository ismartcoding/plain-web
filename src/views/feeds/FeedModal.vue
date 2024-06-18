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
          ref="inputRef"
          class="form-control"
          :label="$t('name')"
          :error="valueError"
          :error-text="valueError ? $t(valueError) : ''"
          v-model="inputValue"
          @keyup.enter="doAction"
        />
      </div>
      <div class="form-row">
        <label class="form-check-label">
          <md-checkbox touch-target="wrapper" @change="toggleFetchContent" :checked="fetchContent" />
          {{ $t('fetch_content_automatically') }}
        </label>
      </div>
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="loading" @click="doAction" autofocus> <md-circular-progress indeterminate v-if="loading" slot="icon" /> {{ $t('save') }} </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { initMutation, updateFeedGQL } from '@/lib/api/mutation'
import type { IFeed } from '@/lib/interfaces'
import { useField, useForm } from 'vee-validate'
import { nextTick, ref, type PropType } from 'vue'
import { string } from 'yup'
import { popModal } from '@/components/modal'
import type { MdCheckbox } from '@material/web/checkbox/checkbox'

const { handleSubmit } = useForm()

const inputRef = ref<HTMLInputElement>()
const fetchContent = ref(false)
function toggleFetchContent(e: Event) {
  fetchContent.value = (e.target as MdCheckbox).checked
}
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
fetchContent.value = props.data?.fetchContent ?? false
;(async () => {
  await nextTick()
  inputRef.value?.focus()
})()

const doAction = handleSubmit(() => {
  mutate({ id: props.data?.id, name: inputValue.value, fetchContent: fetchContent.value })
})

onDone(() => {
  popModal()
})
</script>
