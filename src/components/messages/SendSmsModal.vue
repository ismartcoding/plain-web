<template>
  <v-modal @close="cancel">
    <template #headline>
      {{ $t('send_sms') }}
    </template>
    <template #content>
      <div class="form-row">
        <v-text-field ref="numberRef" v-model="number" type="tel" :label="$t('phone_number')" :error="!!errors.number" :error-text="errors.number ? $t(errors.number) : ''" />
      </div>
      <div class="form-row">
        <v-text-field v-model="body" type="textarea" :rows="4" :label="$t('content')" :error="!!errors.body" :error-text="errors.body ? $t(errors.body) : ''" />
      </div>
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="cancel">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="send" :loading="loading" @click="submit">
        {{ $t('send') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useForm } from 'vee-validate'
import { object, string } from 'yup'
import { popModal } from '@/components/modal'
import { initMutation, sendSmsGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'

const props = defineProps({
  number: { type: String, default: '' },
  body: { type: String, default: '' },
})

const { errors, defineField, handleSubmit } = useForm({
  validationSchema: object({
    number: string().trim().required(),
    body: string().trim().required(),
  }),
  initialValues: {
    number: props.number,
    body: props.body,
  },
})

const [number] = defineField('number')
const [body] = defineField('body')

const { mutate, loading, onDone } = initMutation({
  document: sendSmsGQL,
})

const numberRef = ref<HTMLInputElement>()

const cancel = () => {
  popModal()
}

const submit = handleSubmit(() => {
  mutate({ number: number.value, body: body.value })
})

onDone(() => {
  emitter.emit('sms_sent')
  popModal()
})

onMounted(async () => {
  await nextTick()
  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur()
        }
        numberRef.value?.focus()
      } catch (error) {
        console.debug('Focus blocked:', error)
      }
    }, 100)
  })
})
</script>

<style scoped lang="scss">
.form-row {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}
</style>
