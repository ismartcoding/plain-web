<template>
  <teleport to="body">
    <div class="v-modal-backdrop" @click="handleBackdropClick">
      <div class="v-modal-container" :class="modalId ? `modal-${modalId}` : ''" @click.stop>
        <div class="v-modal-content">
          <!-- Headline slot -->
          <div v-if="$slots.headline" class="v-modal-headline">
            <slot name="headline"></slot>
          </div>
          
          <!-- Content slot -->
          <div v-if="$slots.content" class="v-modal-body">
            <slot name="content"></slot>
          </div>
          
          <!-- Actions slot -->
          <div v-if="$slots.actions" class="v-modal-actions">
            <slot name="actions"></slot>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

interface Props {
  type?: string
  backgroundClose?: boolean
  modalId?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  backgroundClose: true,
  modalId: ''
})

// 禁用属性自动继承，因为teleport会导致警告
defineOptions({
  inheritAttrs: false
})

const emit = defineEmits<{
  close: []
  cancel: []
}>()

// 处理背景点击
const handleBackdropClick = () => {
  if (props.backgroundClose) {
    emit('close')
  }
}

// 处理ESC键
const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

// 阻止背景滚动
const disableBodyScroll = () => {
  document.body.style.overflow = 'hidden'
}

const enableBodyScroll = () => {
  document.body.style.overflow = ''
}

onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
  disableBodyScroll()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
  enableBodyScroll()
})

// 提供show方法以兼容MD Dialog的API
defineExpose({
  show: () => {
    // Vue Modal默认已经显示，这里为了API兼容性
  }
})
</script>

<style lang="scss" scoped>
.v-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade-in 0.15s ease-out;
}

.v-modal-container {
  position: relative;
  min-width: 360px;
  max-width: 90vw;
  max-height: 90vh;
  background-color: var(--md-sys-color-surface-container-high, var(--md-sys-color-surface-variant));
  border-radius: 28px;
  box-shadow: 
    0px 11px 15px -7px rgba(0, 0, 0, 0.2),
    0px 24px 38px 3px rgba(0, 0, 0, 0.14),
    0px 9px 46px 8px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  animation: modal-enter 0.15s ease-out;
}

.v-modal-content {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  --outlined-field-bg: var(--md-sys-color-surface-container-high);
}

.v-modal-headline {
  padding: 24px 24px 0 24px;
  font-size: 1.375rem;
  font-weight: 500;
  line-height: 1.6;
  color: var(--md-sys-color-on-surface);
}

.v-modal-body {
  padding: 24px;
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.5;
  overflow-y: auto;
  flex: 1;
}

.v-modal-actions {
  padding: 0 24px 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.v-modal-container:has(.v-modal-content[data-type="alert"]) {
  .v-modal-actions {
    justify-content: center;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dark {
  .v-modal-container {
    --md-sys-color-surface-container-high: var(--md-sys-color-surface-variant);
  }
}
</style> 