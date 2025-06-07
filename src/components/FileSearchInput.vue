<template>
  <md-chip-set>
    <div v-if="props.filter.text" key="filter-text">
      <md-input-chip :label="props.filter.text" remove-only @remove="removeText" />
    </div>
    <div v-if="props.filter.showHidden" key="filter-show-hidden">
      <md-input-chip :label="$t('show_hidden')" remove-only @remove="removeShowHidden">
        <i-material-symbols:hide-source-outline-rounded slot="icon" />
      </md-input-chip>
    </div>
  </md-chip-set>
  <dropdown v-model="searchPanelVisible" :maxHeight="400">
    <template #trigger>
      <button v-tooltip="$t('search')" class="btn-icon">
        <md-ripple />
        <i-material-symbols:search-rounded />
      </button>
    </template>
    <div class="filters">
      <div class="form-row">
        <outlined-text-field v-model="searchFilter.text" :label="$t('keywords')" @keyup.enter="applyAndDoSearch" />
      </div>
      <md-chip-set>
        <md-filter-chip key="chip-show-hidden" :label="$t('show_hidden')" :selected="searchFilter.showHidden" @click="toggleShowHidden" />
      </md-chip-set>
      <div class="buttons">
        <filled-button @click.stop="applyAndDoSearch">
          {{ $t('search') }}
        </filled-button>
      </div>
    </div>
  </dropdown>
</template>

<script setup lang="ts">
import { reactive, ref, watch, type PropType } from 'vue'
import Dropdown from '@/components/Dropdown.vue'
import type { IFileFilter } from '@/lib/interfaces'
import { replacePath } from '@/plugins/router'
import { useSearch } from '@/hooks/files'
import { useMainStore } from '@/stores/main'

const { copyFilter, buildQ } = useSearch()
const mainStore = useMainStore()
const searchFilter: IFileFilter = reactive({
  showHidden: false,
  linkName: '',
  text: '',
  parent: '',
})
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
})

const searchPanelVisible = ref(false)

// Watch for panel visibility changes and sync filter state when opening
watch(searchPanelVisible, (isVisible) => {
  if (isVisible) {
    copyFilter(props.filter, searchFilter)
  }
})

function applyAndDoSearch() {
  copyFilter(searchFilter, props.filter)
  doSearch()
  searchPanelVisible.value = false
}

function doSearch() {
  replacePath(mainStore, props.getUrl(buildQ(props.filter)))
}

function removeText() {
  props.filter.text = ''
  doSearch()
}

function removeShowHidden() {
  props.filter.showHidden = false
  doSearch()
}

function toggleShowHidden() {
  searchFilter.showHidden = !searchFilter.showHidden
}

defineExpose({ dismiss: () => { searchPanelVisible.value = false } })
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
