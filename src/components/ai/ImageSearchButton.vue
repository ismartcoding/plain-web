<template>
  <v-icon-button v-tooltip="$t('ai.image_search')" @click="modalOpen = true">
    <i-lucide:brain />
    <span v-if="status?.status === 'READY'" class="ai-dot" />
  </v-icon-button>
  <AIImageSearchModal v-if="modalOpen" @close="modalOpen = false" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useImageSearch } from '@/hooks/image-search'
import AIImageSearchModal from './AIImageSearchModal.vue'

const modalOpen = ref(false)
const { status } = useImageSearch()
</script>

<style lang="scss" scoped>
.ai-dot {
  position: absolute; top: 6px; right: 6px; width: 6px; height: 6px;
  border-radius: 50%; background: var(--md-sys-color-primary);
}
</style>
