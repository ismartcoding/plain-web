<template>
  <FileInfoItem v-if="current?.type && !isTrashed" :label="$t('tags')">
    <template #label>
      {{ $t('tags') }}
      <v-icon-button 
        v-tooltip="$t('add_to_tags')" 
        class="info-tag-btn" 
        @click.prevent="$emit('add-to-tags')"
      >
        <i-material-symbols:label-outline-rounded />
      </v-icon-button>
    </template>
    <item-tags :tags="fileInfo?.tags" />
  </FileInfoItem>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ISource } from './types'

const props = defineProps({
  current: {
    type: Object as () => ISource | undefined,
    required: true,
  },
  fileInfo: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['add-to-tags'])

const isTrashed = computed(() => {
  return props.current?.path?.includes('.trashed-') === true
})
</script>

<style lang="scss" scoped>
.info-tag-btn {
  margin-left: 4px;
}
</style> 