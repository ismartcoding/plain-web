<template>
  <v-modal @close="close">
    <template #headline>{{ $t('device_info') }}</template>
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
    </template>
    <template #actions>
      <v-outlined-button @click="close">{{ $t('close') }}</v-outlined-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type { IPeer } from '@/lib/interfaces'
import { popModal } from '@/components/modal'

defineProps({
  peer: { type: Object as PropType<IPeer | null>, default: null },
})

function close() {
  popModal()
}
</script>
