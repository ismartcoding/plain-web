<template>
  <v-modal @close="close">
    <template #headline>{{ $t('chat_info') }}</template>
    <template #content>
      <div v-if="peer" class="info-list">
        <div class="key-value">
          <span class="key">{{ $t('ip_address') }}</span>
          <span class="value">{{ peer.ip }}</span>
        </div>
        <div class="key-value">
          <span class="key">{{ $t('port') }}</span>
          <span class="value">{{ peer.port }}</span>
        </div>
        <div class="key-value">
          <span class="key">{{ $t('device_type') }}</span>
          <span class="value">{{ peer.deviceType }}</span>
        </div>
        <div class="key-value">
          <span class="key">{{ $t('status') }}</span>
          <span class="value">{{ peer.status }}</span>
        </div>
      </div>
      <p v-if="confirming" class="confirm-text">{{ $t('clear_messages_confirm') }}</p>
    </template>
    <template #actions>
      <template v-if="confirming">
        <v-outlined-button @click="confirming = false">{{ $t('cancel') }}</v-outlined-button>
        <v-filled-button :loading="clearing" @click="doClear">{{ $t('clear_messages') }}</v-filled-button>
      </template>
      <template v-else>
        <v-outlined-button @click="close">{{ $t('cancel') }}</v-outlined-button>
        <v-outlined-button @click="confirming = true">{{ $t('clear_messages') }}</v-outlined-button>
      </template>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { PropType } from 'vue'
import type { IPeer } from '@/lib/interfaces'
import { popModal } from '@/components/modal'

const props = defineProps({
  peer: { type: Object as PropType<IPeer | null>, default: null },
  onClear: { type: Function as PropType<() => Promise<void>>, required: true },
})

const confirming = ref(false)
const clearing = ref(false)

function close() {
  popModal()
}

async function doClear() {
  clearing.value = true
  try {
    await props.onClear()
    popModal()
  } finally {
    clearing.value = false
  }
}
</script>

<style lang="scss" scoped>
.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.confirm-text {
  margin-top: 12px;
  color: var(--md-sys-color-error);
  font-size: 0.875rem;
}
</style>
