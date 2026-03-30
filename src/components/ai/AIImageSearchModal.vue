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
        :enable-loading="enableLoading"
        @activate="enable" @upload-done="onUploadDone"
      />

      <AISearchActiveView
        v-else
        :status="status" :index-progress="indexProgress"
        :start-index-loading="startIndexLoading"
        :cancel-index-loading="cancelIndexLoading"
        :disable-loading="disableLoading"
        @start-index="startIndex" @cancel-index="cancelIndex"
        @cancel-download="disable" @delete="disable"
      />
    </template>
    <template #actions>
      <v-outlined-button @click="$emit('close')">{{ $t('close') }}</v-outlined-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { useImageSearch } from '@/hooks/image-search'
import AISearchSetupView from './AISearchSetupView.vue'
import AISearchActiveView from './AISearchActiveView.vue'

defineEmits<{ close: [] }>()
const { status, enable, disable, startIndex, cancelIndex, indexProgress, refetch, enableLoading, startIndexLoading, cancelIndexLoading, disableLoading } = useImageSearch()

function onUploadDone() {
  enable()
  refetch()
}
</script>

<style lang="scss">
.modal-ai-search {
  max-width: 440px;
}
</style>

<style lang="scss" scoped>
.ai-modal-loading {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}
</style>
