<template>
  <section
    v-if="!isPhone"
    class="app-item selectable-card"
    :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
    @click.stop="handleItemClick($event, item, index, () => {})"
    @mouseenter.stop="handleMouseOver($event, index)"
  >
    <div class="start">
      <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, index)" />
      <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, index)" />
      <span class="number"><field-id :id="index + 1" :raw="item" /></span>
    </div>

    <img class="image" width="50" height="50" :src="item.icon" />

    <div class="title">{{ item.name }} ({{ item.version }})</div>

    <div class="subtitle">
      <span>{{ item.id }}</span>
      <span>{{ formatFileSize(item.size) }}</span>
      <span>{{ $t('app_type.' + item.type) }}</span>
    </div>

    <div class="actions">
      <AppActionButtons :item="item" :is-phone="isPhone" @uninstall="uninstall" @download="download" @cancel-uninstall="cancelUninstall" />
    </div>

    <div class="time">
      <span v-tooltip="formatDateTimeFull(item.installedAt)">{{ $t('installed_at') }}: {{ formatDateTime(item.installedAt) }} </span>
      <span v-tooltip="formatDateTimeFull(item.updatedAt)">{{ $t('updated_at') }}: {{ formatDateTime(item.updatedAt) }} </span>
    </div>
  </section>

  <!-- Phone Layout -->
  <ListItemPhone
    v-else
    :is-selected="selectedIds.includes(item.id)"
    :is-selecting="shiftEffectingIds.includes(item.id)"
    :checkbox-checked="shiftEffectingIds.includes(item.id) ? shouldSelect : selectedIds.includes(item.id)"
    @click="handleItemClick($event, item, index, () => {})"
    @mouseenter.stop="handleMouseOver($event, index)"
    @checkbox-click="(event: MouseEvent) => toggleSelect(event, item, index)"
  >
    <template #image>
      <img class="image" :src="item.icon" />
    </template>

    <template #title>{{ item.name }} ({{ item.version }})</template>

    <template #subtitle>
      <div class="subtitle">{{ item.id }}</div>
      <div class="subtitle">
        <span>{{ formatFileSize(item.size) }}</span>
        <span>{{ $t('app_type.' + item.type) }}</span>
      </div>
      <div class="subtitle">{{ $t('installed_at') }}: {{ formatDateTime(item.installedAt) }}</div>
      <div class="subtitle">{{ $t('updated_at') }}: {{ formatDateTime(item.updatedAt) }}</div>
    </template>

    <template #actions>
      <AppActionButtons :item="item" :is-phone="isPhone" @uninstall="uninstall" @download="download" @cancel-uninstall="cancelUninstall" />
    </template>
  </ListItemPhone>
</template>

<script setup lang="ts">
import type { IPackageItem } from '@/lib/interfaces'
import { formatDateTime, formatDateTimeFull, formatFileSize } from '@/lib/format'
import AppActionButtons from './AppActionButtons.vue'

const props = defineProps<{
  item: IPackageItem
  index: number
  selectedIds: string[]
  shiftEffectingIds: string[]
  shouldSelect: boolean
  isPhone: boolean
  handleItemClick: (event: MouseEvent, item: IPackageItem, index: number, callback: () => void) => void
  handleMouseOver: (event: MouseEvent, index: number) => void
  toggleSelect: (event: MouseEvent, item: IPackageItem, index: number) => void
}>()

const emit = defineEmits<{
  uninstall: [item: IPackageItem]
  download: [item: IPackageItem]
  cancelUninstall: [item: IPackageItem]
}>()

function uninstall() {
  emit('uninstall', props.item)
}

function download() {
  emit('download', props.item)
}

function cancelUninstall() {
  emit('cancelUninstall', props.item)
}
</script>
