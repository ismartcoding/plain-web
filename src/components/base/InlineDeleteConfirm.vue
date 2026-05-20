<template>
  <div class="inline-delete-confirm" @click.stop>
    <div class="inline-delete-confirm-msg">{{ count !== undefined ? $t('confirm_to_delete', { count }) : $t('confirm_to_delete_name', { name }) }}</div>
    <div class="inline-delete-confirm-actions">
      <v-outlined-button class="btn-sm" @click.stop="$emit('cancel')">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button class="btn-sm danger" :loading="loading" @click.stop="$emit('confirm')">{{ $t('delete') }}</v-filled-button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ name?: string; count?: number; loading?: boolean }>()
defineEmits<{ confirm: []; cancel: [] }>()
</script>

<style scoped lang="scss">
.inline-delete-confirm {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 180px;
}

.inline-delete-confirm-msg {
  font-size: 13px;
  color: var(--md-sys-color-on-surface);
  line-height: 1.4;
  white-space: break-spaces;
}

.inline-delete-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
