<template>
  <div class="title">
    {{ $t('screen_mirror') }}
    <template v-if="mirroring">
      <div v-if="!hasFeature(FEATURE.MIRROR_AUDIO, osVersion)" class="warning-indicator">
        <v-dropdown v-model="warnOpen1">
          <template #trigger>
            <button class="btn-icon warning-icon"><i-material-symbols:warning-outline /></button>
          </template>
          <div class="warning-dropdown">
            <div class="warning-content">
              <i-material-symbols:error-outline-rounded />
              <div class="warning-text">{{ $t('mirror_audio_not_supported') }}</div>
            </div>
          </div>
        </v-dropdown>
      </div>
      <div v-else-if="!permissions.includes('RECORD_AUDIO')" class="warning-indicator">
        <v-dropdown v-model="warnOpen2">
          <template #trigger>
            <button class="btn-icon warning-icon"><i-material-symbols:warning-outline /></button>
          </template>
          <div class="warning-dropdown">
            <div class="warning-content">
              <i-material-symbols:error-outline-rounded />
              <div class="warning-text">{{ $t('mirror_audio_no_permission') }}</div>
            </div>
            <div class="warning-actions">
              <v-filled-button class="btn-sm" :loading="audioRequesting" @click="$emit('requestAudioPermission')">
                {{ $t('grant_permission') }}
              </v-filled-button>
            </div>
          </div>
        </v-dropdown>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FEATURE } from '@/lib/data'
import { hasFeature } from '@/lib/feature'

defineProps<{
  mirroring: boolean
  audioRequesting: boolean
  osVersion: number
  permissions: string[]
}>()

defineEmits<{
  (e: 'requestAudioPermission'): void
}>()

const warnOpen1 = ref(false)
const warnOpen2 = ref(false)
</script>

<style scoped lang="scss">
.title {
  flex: 1;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.media-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
</style>
