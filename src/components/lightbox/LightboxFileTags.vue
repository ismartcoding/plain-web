<template>
  <LightboxFileInfoItem v-if="current?.type && !isTrashed" :label="$t('tags')">
    <template #label>
      {{ $t('tags') }}
      <TagRelationsDropdown
        :type="current.type"
        :tags="tagsForType"
        :item="{ key: current.data?.id ?? '', title: current.data?.title ?? '', size: current.data?.size ?? 0 }"
        :selected="fileInfo?.tags ?? []"
      />
    </template>
    <item-tags :tags="fileInfo?.tags" />
  </LightboxFileInfoItem>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ISource } from './types'
import type { ITag } from '@/lib/interfaces'

const props = defineProps({
  current: {
    type: Object as () => ISource | undefined,
    required: true,
  },
  fileInfo: {
    type: Object,
    default: null,
  },
  tagsMap: {
    type: Object as () => Map<string, ITag[]>,
    required: true,
  },
})

const isTrashed = computed(() => {
  return props.current?.path?.includes('.trashed-') === true
})

const tagsForType = computed(() => {
  return props.tagsMap.get(props.current?.type ?? '') ?? []
})
</script>

<style lang="scss" scoped>
.info-tag-btn {
  margin-left: 4px;
}
</style> 