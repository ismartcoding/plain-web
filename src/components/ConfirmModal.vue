<template>
  <md-dialog type="alert">
    <div slot="headline">
      {{ title || $t('confirm') }}
    </div>
    <section slot="content" method="dialog">
      <pre>{{ message }}</pre>
    </section>
    <div slot="actions">
      <md-filled-button form="form" value="ok" @click="ok">
        {{ $t('ok') }}
      </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { popModal } from './modal'

defineProps({
  title: { type: String },
  message: { type: String },
})

function ok() {
  popModal()
}
</script>
