<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="modelValue" class="backdrop" @click.self="close">
        <div class="dialog">
          <div class="header">
            <div class="icon-wrap">
              <i-lucide-alert-triangle />
            </div>
            <h3 class="title">{{ $t('image_editor.delete_confirm_title') }}</h3>
          </div>
          <p class="desc">{{ $t('image_editor.delete_confirm_desc') }}</p>
          <div class="actions">
            <button class="btn btn-text" @click="close">
              {{ $t('image_editor.cancel') }}
            </button>
            <button class="btn btn-danger" @click="confirm">
              {{ $t('image_editor.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
}>()

function close() { emit('update:modelValue', false) }
function confirm() { emit('update:modelValue', false); emit('confirm') }
</script>

<style lang="scss" scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 16px;
}

.dialog {
  background: var(--md-sys-color-surface-container-high);
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);
  padding: 24px;
  max-width: 384px;
  width: 100%;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);
  color: var(--md-sys-color-error);
  font-size: 20px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.desc {
  font-size: 14px;
  color: var(--md-sys-color-on-surface-variant);
  margin: 0 0 16px;
  line-height: 1.5;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;

  &.btn-text {
    background: transparent;
    color: var(--md-sys-color-on-surface-variant);
    &:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent); }
  }
  &.btn-danger {
    background: var(--md-sys-color-error);
    color: var(--md-sys-color-on-error, #fff);
    &:hover { filter: brightness(0.92); }
  }
}

.confirm-enter-active, .confirm-leave-active { transition: opacity 0.2s; }
.confirm-enter-from, .confirm-leave-to { opacity: 0; }
</style>
