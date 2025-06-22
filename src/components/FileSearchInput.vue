<template>
  <!-- Desktop FileSearchFilters -->
  <FileSearchFilters v-if="showChips" :filter="filter" @filter-change="onFilterChange" />

  <!-- Desktop dropdown search -->
  <v-dropdown v-if="!isPhone" v-model="searchPanelVisible" :max-height="400">
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

  <!-- Mobile search button -->
  <button v-if="isPhone" v-tooltip="$t('search')" class="btn-icon mobile-search-btn" @click="openMobileSearch">
    <i-material-symbols:search-rounded />
  </button>

  <!-- Mobile search BottomSheet -->
  <BottomSheet v-if="isPhone" v-model="mobileSearchVisible" :title="$t('search')" show-footer>
    <label class="form-label">{{ $t('keywords') }}</label>
    <v-text-field v-model="localFilter.text" @keyup.enter="applyMobileSearch" />
    <v-chip-set style="margin-block-start: 16px">
      <v-filter-chip :label="$t('show_hidden')" :selected="localFilter.showHidden" @click="toggleShowHidden" />
    </v-chip-set>

    <template #footer>
      <v-filled-button class="search-apply-btn" @click="applyMobileSearch">
        {{ $t('search') }}
      </v-filled-button>
    </template>
  </BottomSheet>
</template>

<script setup lang="ts">
import { reactive, ref, watch, type PropType } from 'vue'
import type { IFileFilter } from '@/lib/interfaces'
import { replacePath } from '@/plugins/router'
import { useSearch } from '@/hooks/files'
import { useMainStore } from '@/stores/main'
import FileSearchFilters from './FileSearchFilters.vue'

const { buildQ } = useSearch()
const mainStore = useMainStore()

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
    default: () => {},
  },
  showChips: {
    type: Boolean,
    default: true,
  },
  isPhone: {
    type: Boolean,
    default: false,
  },
})

const searchPanelVisible = ref(false)
const mobileSearchVisible = ref(false)

// Local filter state for search panel
const localFilter = reactive<IFileFilter>({
  showHidden: false,
  type: '',
  rootPath: '',
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

watch(mobileSearchVisible, (isVisible) => {
  if (isVisible) {
    Object.assign(localFilter, props.filter)
  }
})

// Check if the input text looks like an absolute path
function isAbsolutePath(text: string): boolean {
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

function openMobileSearch() {
  mobileSearchVisible.value = true
}

function applyMobileSearch() {
  const inputText = localFilter.text?.trim()
  
  // If the input looks like an absolute path, navigate to that directory
  if (inputText && isAbsolutePath(inputText) && props.navigateToDir) {
    props.navigateToDir(inputText)
    mobileSearchVisible.value = false
    return
  }
  
  // Otherwise, perform normal search
  doSearch()
  mobileSearchVisible.value = false
}

function doSearch() {
  Object.assign(props.filter, localFilter)
  navigateToSearch(props.filter)
}

// Navigate to search results
function navigateToSearch(filter: IFileFilter) {
  replacePath(mainStore, props.getUrl(buildQ(filter)))
}

// Toggle show hidden files
function toggleShowHidden() {
  localFilter.showHidden = !localFilter.showHidden
}

function onFilterChange(newFilter: IFileFilter) {
  Object.assign(props.filter, newFilter)
  replacePath(mainStore, props.getUrl(buildQ(props.filter)))
}

defineExpose({
  dismiss: () => {
    searchPanelVisible.value = false
    mobileSearchVisible.value = false
  },
})
</script>

<style lang="scss" scoped>
/* Desktop styles */
.filters {
  padding: 16px;
  min-width: 400px;

  .buttons {
    text-align: right;
    margin-block-start: 16px;
  }
}

.form-label {
  margin-block-start: 16px;
}

.search-apply-btn {
  width: 100%;
}
</style>
