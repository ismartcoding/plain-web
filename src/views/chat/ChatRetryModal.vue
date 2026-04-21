<template>
  <v-modal @close="popModal">
    <template #headline>{{ $t('send_failed') }}</template>
    <template #actions>
      <v-outlined-button @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button @click="doResend">{{ $t('try_again') }}</v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import { popModal } from '@/components/modal'

const props = defineProps({
  onResend: {
    type: Function as PropType<() => void>,
    required: true,
  },
})

function doResend() {
  props.onResend()
  popModal()
}
</script>
