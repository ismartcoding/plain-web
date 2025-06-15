<template>
  <div v-if="modelValue" class="bottom-sheet-overlay" @click="closeSheet">
    <div class="bottom-sheet-container" @click.stop>
      <!-- Header -->
      <div class="bottom-sheet-header">
        <button class="btn-icon" @click="closeSheet">
          <i-lucide:x />
        </button>
        <h2 class="bottom-sheet-title">{{ title }}</h2>
        <div class="bottom-sheet-placeholder"></div>
      </div>

      <!-- Content -->
      <div class="bottom-sheet-content">
        <slot />
      </div>

      <!-- Footer -->
      <div v-if="showFooter" class="bottom-sheet-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  showFooter: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function closeSheet() {
  emit('update:modelValue', false)
}
</script>

<style lang="scss" scoped>
.bottom-sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.bottom-sheet-container {
  background: var(--md-sys-color-surface);
  border-radius: 16px 16px 0 0;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.bottom-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0px 16px;
}

.bottom-sheet-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.bottom-sheet-placeholder {
  width: 44px; /* Same width as close button for balance */
}

.bottom-sheet-content {
  flex: 1;
  overflow-y: auto;
  padding-inline: 20px;
}

.bottom-sheet-footer {
  padding: 20px;
  flex-shrink: 0;
}
</style> 