<template>
  <v-chip-set>
    <div v-if="filter.text" key="filter-text">
      <v-input-chip :label="filter.text" remove-only @remove="() => removeFilter('text')" />
    </div>
    <div v-if="filter.showHidden" key="filter-show-hidden">
      <v-input-chip :label="$t('show_hidden')" remove-only @remove="() => removeFilter('showHidden')">
        <i-material-symbols:hide-source-outline-rounded />
      </v-input-chip>
    </div>
  </v-chip-set>
  <v-dropdown v-model="searchPanelVisible" :max-height="400">
    <template #trigger>
      <button v-tooltip="$t('search')" class="btn-icon">
        <i-material-symbols:search-rounded />
      </button>
    </template>
    <div class="filters">
      <div class="form-row">
        <v-text-field v-model="localFilter.text" :label="$t('keywords')" @keyup.enter="applySearch" />
      </div>
      <v-chip-set>
        <v-filter-chip key="chip-show-hidden" :label="$t('show_hidden')" :selected="localFilter.showHidden" @click="toggleShowHidden" />
      </v-chip-set>
      <div class="buttons">
        <v-filled-button @click.stop="applySearch">
          {{ $t('search') }}
        </v-filled-button>
      </div>
    </div>
  </v-dropdown>
</template>

<script setup lang="ts">
import { reactive, ref, watch, type PropType } from 'vue'
import Dropdown from '@/components/base/VDropdown.vue'
import type { IFileFilter } from '@/lib/interfaces'
import { replacePath } from '@/plugins/router'
import { useSearch } from '@/hooks/files'
import { useMainStore } from '@/stores/main'

const { buildQ } = useSearch()

const props = defineProps({
  parent: {
    type: String,
    required: true,
  },
  filter: {
    type: Object as PropType<IFileFilter>,
    required: true,
  },
  getUrl: {
    type: Function as PropType<(q: string) => string>,
    required: true,
  },
  navigateToDir: {
    type: Function as PropType<(dir: string) => void>,
    required: false,
  },
})

const mainStore = useMainStore()
const searchPanelVisible = ref(false)

// Local filter state for search panel
const localFilter = reactive<IFileFilter>({
  showHidden: false,
  linkName: '',
  text: '',
  parent: '',
})

watch(props.filter, (newValue) => {
  Object.assign(localFilter, newValue)
}, { immediate: true, deep: true })


watch(searchPanelVisible, (isVisible) => {
  if (isVisible) {
    Object.assign(localFilter, props.filter)
  }
})

// Navigate to search results
function navigateToSearch(filter: IFileFilter) {
  replacePath(mainStore, props.getUrl(buildQ(filter)))
}

// Check if the input text looks like an absolute path
function isAbsolutePath(text: string): boolean {
  // Check for Unix/Android absolute paths (starting with /)
  return text.startsWith('/')
}

// Apply search panel conditions
function applySearch() {
  const inputText = localFilter.text?.trim()
  
  // If the input looks like an absolute path, navigate to that directory
  if (inputText && isAbsolutePath(inputText) && props.navigateToDir) {
    props.navigateToDir(inputText)
    searchPanelVisible.value = false
    return
  }
  
  // Otherwise, perform normal search
  doSearch()
  searchPanelVisible.value = false
}

// Remove filter field
function removeFilter(field: keyof Pick<IFileFilter, 'text' | 'showHidden'>) {
  if (field === 'text') {
    localFilter.text = ''
    doSearch()
  } else if (field === 'showHidden') {
    localFilter.showHidden = false
    doSearch()
  }
}

function doSearch() {
  Object.assign(props.filter, localFilter)
  navigateToSearch(props.filter)
}

// Toggle show hidden files
function toggleShowHidden() {
  localFilter.showHidden = !localFilter.showHidden
}

defineExpose({
  dismiss: () => {
    searchPanelVisible.value = false
  },
})
</script>
<style lang="scss" scoped>
.filters {
  padding: 16px;
  min-width: 400px;

  .buttons {
    text-align: right;
    margin-block-start: 16px;
  }

  .form-label {
    margin-block-start: 16px;
    margin-block-end: 8px;
  }
}
</style>
