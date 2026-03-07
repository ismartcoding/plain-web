<template>
  <v-modal @close="close">
    <template #headline>{{ $t('chat_info') }}</template>
    <template #content>
      <section v-if="peer" class="card chat-detail-card">
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
          <span class="value">
            <span class="chat-status-badge" :class="peer.status">{{ peer.status }}</span>
          </span>
        </div>
      </section>
      <div v-if="confirming" class="chat-confirm-block">
        <i-material-symbols:warning-outline-rounded class="chat-confirm-icon" />
        <p class="chat-confirm-text">{{ $t('clear_messages_confirm') }}</p>
      </div>
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
