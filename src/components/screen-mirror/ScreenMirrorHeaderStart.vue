<template>
  <div class="title">
    {{ $t('screen_mirror') }}
    <template v-if="mirroring">
      <div v-if="!hasFeature(FEATURE.MIRROR_AUDIO, osVersion)" class="warning-indicator">
        <popper>
          <button class="btn-icon warning-icon"><i-material-symbols:warning-outline /></button>
          <template #content>
            <div class="warning-dropdown">
              <div class="warning-content">
                <i-material-symbols:error-outline-rounded />
                <div class="warning-text">{{ $t('mirror_audio_not_supported') }}</div>
              </div>
            </div>
          </template>
        </popper>
      </div>
      <div v-else-if="!permissions.includes('RECORD_AUDIO')" class="warning-indicator">
        <popper>
          <button class="btn-icon warning-icon"><i-material-symbols:warning-outline /></button>
          <template #content>
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
          </template>
        </popper>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
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
