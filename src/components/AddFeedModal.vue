<template>
  <v-modal @close="cancel">
    <template #headline>
      {{ $t('add_subscription') }}
    </template>
    <template #content>
      <div class="form-row">
        <v-text-field ref="inputRef" v-model="inputValue" :label="$t('rss_url')" :error="!!valueError" :error-text="valueError ? $t(valueError) : ''" @keyup.enter="doAction" />
      </div>
      <div class="form-row">
        <label class="form-check-label">
          <v-checkbox touch-target="wrapper" :checked="fetchContent" @change="toggleFetchContent" />
          {{ $t('fetch_content_automatically') }}
        </label>
      </div>
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="cancel">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="save" :disabled="loading" @click="doAction">
        <v-circular-progress v-if="loading" indeterminate />
        {{ $t('save') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { useField, useForm } from 'vee-validate'
import { nextTick, ref, type PropType, onMounted } from 'vue'
import { string } from 'yup'
import { popModal } from './modal'
import { createFeedGQL, initMutation } from '@/lib/api/mutation'


const { handleSubmit } = useForm()

const inputRef = ref<HTMLInputElement>()
const fetchContent = ref(false)
function toggleFetchContent(e: Event) {
  fetchContent.value = (e.target as HTMLInputElement).checked
}
const props = defineProps({
  done: {
    type: Function as PropType<() => void>,
    required: true,
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

const doAction = handleSubmit(() => {
  mutate({ url: inputValue.value ?? '', fetchContent: fetchContent.value })
})

onDone(() => {
  props.done?.call(this)
  popModal()
})
</script>
