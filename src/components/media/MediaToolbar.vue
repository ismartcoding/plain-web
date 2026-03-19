<template>
  <div class="top-app-bar">
    <v-checkbox touch-target="wrapper" :checked="allChecked" :indeterminate="!allChecked && checked" @change="$emit('toggleAllChecked', $event)" />
    <div class="title">
      <span v-if="selectedCount > 0">{{ $t('x_selected', { count: (realAllChecked ? total : selectedCount).toLocaleString() }) }}</span>
      <span v-else>{{ $t(pageTitle) }} ({{ total.toLocaleString() }})</span>
      <template v-if="checked">
        <template v-if="filterTrash">
          <v-icon-button v-tooltip="$t('delete')" @click.stop="$emit('delete')"><i-material-symbols:delete-forever-outline-rounded /></v-icon-button>
          <v-icon-button v-tooltip="$t('restore')" :loading="restoreQueryLoading" @click.stop="$emit('restore')"><i-material-symbols:restore-from-trash-outline-rounded /></v-icon-button>
          <v-icon-button v-tooltip="$t('download')" @click.stop="$emit('download')"><i-material-symbols:download-rounded /></v-icon-button>
        </template>
        <template v-else>
            <v-icon-button v-if="canTrash" v-tooltip="$t('move_to_trash')" :loading="trashQueryLoading" @click.stop="$emit('trash')"><i-material-symbols:delete-outline-rounded /></v-icon-button>
            <v-icon-button v-else v-tooltip="$t('delete')" @click.stop="$emit('delete')"><i-material-symbols:delete-forever-outline-rounded /></v-icon-button>
            <v-icon-button v-tooltip="$t('add_to_tags')" @click.stop="$emit('addToTags')"><i-material-symbols:label-outline-rounded /></v-icon-button>
          <v-icon-button v-tooltip="$t('download')" @click.stop="$emit('download')"><i-material-symbols:download-rounded /></v-icon-button>
          <slot name="extra-actions" />
        </template>
      </template>
    </div>
    <div class="actions"><slot name="actions" /></div>
  </div>
  <div v-if="showSecondary" class="secondary-actions"><slot name="secondary" /></div>
  <all-checked-alert
    :limit="limit"
    :total="total"
    :all-checked-alert-visible="allCheckedAlertVisible"
    :real-all-checked="realAllChecked"
    :select-real-all="() => $emit('selectRealAll')"
    :clear-selection="() => $emit('clearSelection')"
  />
</template>

<script setup lang="ts">
defineProps<{
  pageTitle: string
  selectedCount: number
  allChecked: boolean
  checked: boolean
  realAllChecked: boolean
  total: number
  filterTrash: boolean
  canTrash: boolean
  restoreQueryLoading: boolean
  trashQueryLoading: boolean
  limit: number
  allCheckedAlertVisible: boolean
  showSecondary: boolean
}>()

defineEmits<{
  toggleAllChecked: [event: Event]
  delete: []
  restore: []
  download: []
  trash: []
  addToTags: []
  selectRealAll: []
  clearSelection: []
}>()
</script>
