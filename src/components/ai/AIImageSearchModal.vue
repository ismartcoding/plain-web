<template>
  <v-modal @close="$emit('close')" modal-id="ai-search">
    <template #headline>{{ $t('ai.image_search') }}</template>
    <template #content>
      <div v-if="!status" class="ai-modal-loading">
        <v-circular-progress indeterminate />
      </div>

      <AISearchSetupView
        v-else-if="status.status === 'UNAVAILABLE' || status.status === 'ERROR'"
        :status="status"
      />

      <AISearchActiveView
        v-else
        :status="status"
      />
    </template>
    <template #actions>
      <v-outlined-button @click="$emit('close')">{{ $t('close') }}</v-outlined-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { useImageSearchStatus } from '@/hooks/ai/use-image-search-status'
import AISearchSetupView from './AISearchSetupView.vue'
import AISearchActiveView from './AISearchActiveView.vue'

defineEmits<{ close: [] }>()
const { status } = useImageSearchStatus()
</script>

<style lang="scss" scoped>
.ai-modal-loading {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}
</style>
