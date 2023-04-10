<template>
  <div class="modal-dialog" :class="{ 'modal-sm': size === 'sm', 'modal-lg': size === 'lg' }">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">{{ title }}<slot name="title" /></h5>
        <button type="button" class="btn-close" @click="close">
          <i-material-symbols:close-rounded class="bi" />
        </button>
      </div>
      <div class="modal-body">
        <slot name="body" />
      </div>
      <div class="modal-footer">
        <button v-if="showCancel" type="button" class="btn" @click="close">{{ $t('cancel') }}</button>
        <slot name="action" />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { popModal } from './modal'

defineProps({
  title: { type: String, default: '', required: true },
  size: { type: String, default: '' },
  showCancel: { type: Boolean, default: true },
})

function close() {
  popModal()
}
</script>
