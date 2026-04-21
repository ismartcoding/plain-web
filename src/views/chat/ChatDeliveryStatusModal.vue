<template>
  <v-modal @close="popModal">
    <template #headline>{{ $t('delivery_status') }}</template>
    <template v-if="results.length > 0" #content>
      <p v-if="results.length > 1" class="delivery-summary">
        {{ $t('delivery_status_summary', { delivered: deliveredCount, total: results.length }) }}
      </p>
      <ul v-if="results.length > 1" class="delivery-result-list">
        <li v-for="r in results" :key="r.peerId" class="delivery-result-item">
          <i-material-symbols:check-rounded v-if="!r.error" class="delivery-icon delivered" />
          <i-material-symbols:error-outline-rounded v-else class="delivery-icon failed" />
          <span class="delivery-peer-name">{{ r.peerName }}</span>
          <span v-if="r.error" class="delivery-error-text">{{ r.error }}</span>
        </li>
      </ul>
      <p v-else-if="peerError" class="delivery-error-single">{{ peerError }}</p>
    </template>
    <template #actions>
      <v-outlined-button @click="popModal">{{ $t('close') }}</v-outlined-button>
      <v-filled-button @click="doResend">{{ $t('try_again') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed } from 'vue'
import { popModal } from '@/components/modal'

interface DeliveryResult {
  peerId: string
  peerName: string
  error?: string | null
}

const props = defineProps({
  onResend: {
    type: Function as PropType<() => void>,
    required: true,
  },
  statusData: {
    type: String as PropType<string | undefined>,
    default: undefined,
  },
})

const results = computed<DeliveryResult[]>(() => {
  if (!props.statusData) return []
  try {
    const sd = JSON.parse(props.statusData) as { results?: DeliveryResult[] }
    return sd.results ?? []
  } catch {
    return []
  }
})

const deliveredCount = computed(() => results.value.filter((r) => !r.error).length)
const peerError = computed(() => results.value[0]?.error ?? null)

function doResend() {
  props.onResend()
  popModal()
}
</script>
