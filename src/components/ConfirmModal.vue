<template>
  <v-modal size="sm" :show-cancel="false" :title="$t('confirm')">
    <template #body>
      {{ message }}
    </template>
    <template #action>
      <button type="button" class="btn" @click="ok">{{ $t('ok') }}</button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { popModal } from './modal'

defineProps({
  message: { type: String },
})

function ok() {
  popModal()
}
</script>
