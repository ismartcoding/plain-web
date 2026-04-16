<template>
  <v-icon-button v-tooltip="$t('install_app')" @click="install">
    <i-material-symbols:upload-rounded />
  </v-icon-button>
  <v-dropdown v-model="sortMenuVisible">
    <template #trigger>
      <v-icon-button v-tooltip="$t('sort')" :loading="sorting">
        <i-material-symbols:sort-rounded />
      </v-icon-button>
    </template>
    <div v-for="item in sortItems" :key="item.value" class="dropdown-item" :class="{ 'selected': item.value === appSortBy }" @click="sort(item.value); sortMenuVisible = false">
      {{ $t(item.label) }}
    </div>
  </v-dropdown>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  sorting: boolean
  sortItems: { value: string; label: string }[]
  appSortBy: string
}

defineProps<Props>()

const emit = defineEmits<{
  install: []
  sort: [value: string]
}>()

const sortMenuVisible = ref(false)

function install() {
  emit('install')
}

function sort(value: string) {
  emit('sort', value)
}
</script>

<style scoped lang="scss">
// Actions are displayed inline
</style> 