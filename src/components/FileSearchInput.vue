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
  <button id="btn-search" class="btn-icon" @click.prevent="show" v-tooltip="$t('search')">
    <md-ripple />
    <i-material-symbols:search-rounded />
  </button>
  <md-menu positioning="popover" anchor="btn-search" menu-corner="start-end" anchor-corner="end-end" stay-open-on-focusout quick :open="searchPanelVisible" @closed="hide">
    <div class="filters">
      <div class="form-row">
        <md-outlined-text-field :label="$t('keywords')" v-model="searchFilter.text" @keyup.enter="applyAndDoSearch" />
      </div>
      <md-chip-set>
        <md-filter-chip key="chip-show-hidden" :label="$t('show_hidden')" :selected="searchFilter.showHidden" @click="toggleShowHidden" />
      </md-chip-set>
      <div class="buttons">
        <md-filled-button @click.stop="applyAndDoSearch">
          {{ $t('search') }}
        </md-filled-button>
      </div>
    </div>
  </md-menu>
</template>

<script setup lang="ts">
import { reactive, ref, type PropType } from 'vue'
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

function applyAndDoSearch() {
  copyFilter(searchFilter, props.filter)
  doSearch()
  hide()
}

function doSearch() {
  replacePath(mainStore, props.getUrl(buildQ(props.filter)))
}

function removeText() {
  props.filter.text = ''
  doSearch()
}

function show() {
  searchPanelVisible.value = true
  copyFilter(props.filter, searchFilter)
}

function hide() {
  searchPanelVisible.value = false
}

function removeShowHidden() {
  props.filter.showHidden = false
  doSearch()
}

function toggleShowHidden() {
  searchFilter.showHidden = !searchFilter.showHidden
}

defineExpose({ dismiss: hide })
</script>
<style lang="scss" scoped>
.filters {
  padding: 16px;
  min-width: 400px;

  md-outlined-text-field {
    width: 100%;
  }

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
