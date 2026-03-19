<template>
  <!-- Header variant: single input, filter dropdown is inside TokenSearchField -->
  <div class="header-search">
    <TokenSearchField
      ref="inputRef"
      class="header-search-field"
      :text="text"
      :tokens="uiTokens"
      enter-submits
      :placeholder="resolvedPlaceholder"
      :key-options="keyOptions"
      :value-options="valueOptions"
      @update:text="onFreeTextChange"
      @update:tokens="onUiTokensChange"
      @enter="submitFromHeader"
      @history:select="applyHistoryQ"
      @history:delete="deleteHistoryItem"
      @history:clear="clearHistoryForPage"
    />
  </div>
</template>

<script setup lang="ts">
import type { IBucket, IFeed, IFilter, IFileFilter, ITag, IType } from '@/lib/interfaces'
import TokenSearchField from '@/components/TokenSearchField.vue'
import { useHeaderSearch } from '@/hooks/header-search'

type Kind = 'global' | 'media' | 'files'

const props = withDefaults(
  defineProps<{
    kind?: Kind
    placeholder?: string
    enableSlashFocus?: boolean
    targetPath?: string
    syncRouteQ?: boolean
    filter?: IFilter
    getUrl?: (q: string) => string
    tags?: ITag[]
    buckets?: IBucket[]
    types?: IType[]
    showTrash?: boolean
    fileFilter?: IFileFilter
    getFileUrl?: (q: string) => string
    navigateToDir?: (dir: string) => void
  }>(),
  {
    kind: 'global',
    placeholder: '',
    enableSlashFocus: true,
    targetPath: '',
    syncRouteQ: true,
    filter: undefined,
    getUrl: undefined,
    tags: () => [],
    buckets: () => [],
    types: () => [],
    showTrash: false,
    fileFilter: undefined,
    getFileUrl: undefined,
    navigateToDir: () => {},
  },
)

const {
  inputRef, text, uiTokens, resolvedPlaceholder, keyOptions, valueOptions,
  onFreeTextChange, onUiTokensChange, submitFromHeader, applyHistoryQ, deleteHistoryItem, clearHistoryForPage,
} = useHeaderSearch(props)

defineExpose({ focus: () => inputRef.value?.focus() })
</script>

<style lang="scss" scoped>
.header-search {
  min-width: min(520px, 46vw);
}

.header-search :deep(.header-search-field) {
  width: 100%;
}
</style>
