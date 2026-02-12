<template>
  <v-modal @close="close">
    <template #headline>
      {{ $t('remote_control') }}
    </template>
    <template #content>
      <div class="accessibility-guide">
        <div class="guide-icon">
          <i-material-symbols:accessibility-new-rounded />
        </div>
        <p class="guide-text">{{ $t('accessibility_service_required') }}</p>
        <ol class="guide-steps">
          <li>{{ $t('accessibility_step_1') }}</li>
          <li>{{ $t('accessibility_step_2') }}</li>
          <li>{{ $t('accessibility_step_3') }}</li>
        </ol>
        <p class="guide-note">{{ $t('accessibility_note') }}</p>
      </div>
    </template>
    <template #actions>
      <v-filled-button @click="done">
        {{ $t('ok') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { popModal } from './modal'

const props = defineProps({
  onConfirm: { type: Function, default: null },
})

function close() {
  popModal()
}

function done() {
  popModal()
  props.onConfirm?.()
}
</script>

<style lang="scss" scoped>
.accessibility-guide {
  padding: 0 8px;
  max-width: 400px;
}

.guide-icon {
  text-align: center;
  margin-bottom: 16px;

  i,
  svg {
    width: 64px;
    height: 64px;
    color: var(--md-sys-color-primary);
  }
}

.guide-text {
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 16px;
}

.guide-steps {
  padding-left: 20px;
  margin: 0 0 16px 0;

  li {
    font-size: 0.9rem;
    line-height: 1.8;
    color: var(--md-sys-color-on-surface-variant);
  }
}

.guide-note {
  font-size: 0.85rem;
  color: var(--md-sys-color-on-surface-variant);
  font-style: italic;
}
</style>
