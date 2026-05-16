<template>
  <div>
    <v-text-field
      v-model="manualHost"
      :label="$t('device_discovery.manual_host')"
      class="form-control"
      autocapitalize="none"
      autocorrect="off"
      :spellcheck="false"
      @keyup.enter="selectManual"
    />
    <v-outlined-button v-if="connecting" class="action-btn" :loading="connecting" @click="$emit('cancel')">
      {{ $t('cancel') }}
    </v-outlined-button>
    <v-filled-button v-else class="action-btn" :disabled="!manualHost.trim()" @click="selectManual">
      {{ $t('connect') }}
    </v-filled-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
defineProps<{
  connecting?: boolean
}>()

const emit = defineEmits<{
  (e: 'device-selected', host: string): void
  (e: 'cancel'): void
}>()

const manualHost = ref('')

function stripScheme(value: string): string {
  return value.replace(/^https?:\/\//, '')
}

function selectManual() {
  const host = stripScheme(manualHost.value.trim())
  if (!host) return
  emit('device-selected', host)
}
</script>

<style lang="scss" scoped>
.action-btn {
  margin-top: 16px;
  width: 100%;
}
</style>
