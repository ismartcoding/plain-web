<template>
  <md-dialog type="alert">
    <div slot="headline">{{ $t('confirm') }}</div>
    <form id="form" slot="content" method="dialog">
      {{ message }}
    </form>
    <div slot="actions">
      <md-text-button form="form" value="ok" @click="ok">{{ $t('ok') }}</md-text-button>
    </div>
  </md-dialog>
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
