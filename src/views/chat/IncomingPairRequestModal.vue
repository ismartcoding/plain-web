<template>
  <v-modal @close="deny">
    <template #headline>{{ $t('pair_request') }}</template>
    <template #content>
      <div class="pair-request-card">
        <div class="pair-request-icon"><i-lucide:link /></div>
        <p>{{ $t('pair_request_from', { name: request.fromName }) }}</p>
      </div>
    </template>
    <template #actions>
      <v-outlined-button @click="deny">{{ $t('deny') }}</v-outlined-button>
      <v-filled-button @click="allow">{{ $t('allow') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { popModal } from '@/components/modal'
import type { PairingRequest } from '@/hooks/use-device-pairing'

const props = defineProps({
  request: { type: Object as PropType<PairingRequest>, required: true },
  senderIp: { type: String, required: true },
  onAllow: { type: Function as PropType<() => void>, required: true },
  onDeny: { type: Function as PropType<() => void>, required: true },
})

function allow() {
  props.onAllow()
  popModal()
}

function deny() {
  props.onDeny()
  popModal()
}
</script>

<style lang="scss" scoped>
.pair-request-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  text-align: center;

  .pair-request-icon {
    font-size: 1.75rem;
    color: var(--md-sys-color-primary);
  }

  p {
    margin: 0;
    font-size: 0.95rem;
    color: var(--md-sys-color-on-surface);
  }
}
</style>
