<template>
  <v-modal @close="popModal">
    <template #headline>
      {{ $t('update_subscription') }}
    </template>
    <template #content>
      <div class="form-label">
        {{ data?.url }}
      </div>
      <div class="form-row">
        <v-text-field
          ref="inputRef"
          v-model="inputValue"
          class="form-control"
          :label="$t('name')"
          :error="!!valueError"
          :error-text="valueError ? $t(valueError) : ''"
          @keyup.enter="doAction"
        />
      </div>
      <div class="form-row">
        <label class="form-check-label">
          <v-checkbox touch-target="wrapper" :checked="fetchContent" @change="toggleFetchContent" />
          {{ $t('fetch_content_automatically') }}
        </label>
      </div>
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="save" :loading="loading" @click="doAction">
        {{ $t('save') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { initMutation, updateFeedGQL } from '@/lib/api/mutation'
import type { IFeed } from '@/lib/interfaces'
import { useField, useForm } from 'vee-validate'
import { nextTick, ref, type PropType } from 'vue'
import { string } from 'yup'
import { popModal } from '@/components/modal'


const { handleSubmit } = useForm()

const inputRef = ref<HTMLInputElement>()
const fetchContent = ref(false)
function toggleFetchContent(e: Event) {
  fetchContent.value = (e.target as HTMLInputElement).checked
}
const props = defineProps({
  data: {
    type: Object as PropType<IFeed>,
    required: true,
  },
})

const { mutate, loading, onDone } = initMutation({
  document: updateFeedGQL,
})
const { value: inputValue, errorMessage: valueError } = useField('inputValue', string().required())
inputValue.value = props.data?.name ?? ''
fetchContent.value = props.data?.fetchContent ?? false

// Focus management
;(async () => {
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
})()

const doAction = handleSubmit(() => {
  mutate({ id: props.data?.id, name: inputValue.value, fetchContent: fetchContent.value })
})

onDone(() => {
  popModal()
})
</script>
