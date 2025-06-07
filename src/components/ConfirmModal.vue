<template>
  <v-modal @close="ok">
    <template #headline>
      {{ title || $t('confirm') }}
    </template>
    <template #content>
      <pre>{{ message }}</pre>
    </template>
    <template #actions>
      <v-filled-button @click="ok">
        {{ $t('ok') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { popModal } from './modal'

defineProps({
  title: { type: String, default: '' },
  message: { type: String, default: '' },
})

function ok() {
  popModal()
}
</script>
