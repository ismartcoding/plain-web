<template>
  <v-modal @close="close">
    <template #headline>{{ $t('device_info') }}</template>
    <template #content>
      <ul v-if="peer" class="card list-items">
        <v-list-item :title="$t('ip_address')" :value="peer.ip" />
        <v-list-item :title="$t('port')" :value="String(peer.port)" />
        <v-list-item :title="$t('device_type')" :value="deviceTypeText" />
        <v-list-item :title="$t('status')">
          <template #value>
            <span class="chat-status-badge" :class="peer.status">{{ peer.status }}</span>
          </template>
        </v-list-item>
      </ul>
    </template>
    <template #actions>
      <v-outlined-button @click="close">{{ $t('close') }}</v-outlined-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IPeer } from '@/lib/interfaces'
import { popModal } from '@/components/modal'

const { t } = useI18n()

const props = defineProps({
  peer: { type: Object as PropType<IPeer | null>, default: null },
})

const deviceTypeMap: Record<string, string> = {
  phone: 'phone',
  tablet: 'tablet',
  pc: 'computer',
  tv: 'tv',
}

const deviceTypeText = computed(() => {
  const dt = props.peer?.deviceType
  if (!dt) return ''
  const key = deviceTypeMap[dt]
  return key ? t(key) : dt
})

function close() {
  popModal()
}
</script>
