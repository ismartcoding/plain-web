<template>
  <section
    class="doc-item selectable-card"
    :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
    @click.stop="handleItemClick($event, item, index, () => $emit('open-file', item))"
    @mouseenter.stop="handleMouseOver($event, index)"
  >
    <div class="start">
      <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, index)" />
      <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, index)" />
      <span class="number"><field-id :id="index + 1" :raw="item" /></span>
    </div>

    <div class="doc-icon">
      <img :src="`/ficons/${item.extension}.svg`" class="svg" @error="onIconError" />
    </div>

    <div class="title">{{ item.name }}</div>

    <div class="subtitle">
      <span>{{ formatFileSize(item.size) }}</span>
      <span v-tooltip="formatDateTimeFull(item.updatedAt)">{{ formatTimeAgo(item.updatedAt) }}</span>
    </div>

    <DocActionButtons
      :item="item"
      @download-file="$emit('download-file', $event)"
      @delete-item="$emit('delete-item', $event)"
      @open-file="$emit('open-file', $event)"
      @rename-item="$emit('rename-item', $event)"
      @duplicate-item="$emit('duplicate-item', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import type { IDoc } from '@/lib/interfaces'
import { formatFileSize, formatDateTimeFull, formatTimeAgo } from '@/lib/format'
import DocActionButtons from './DocActionButtons.vue'

defineProps<{
  item: IDoc
  index: number
  selectedIds: string[]
  shiftEffectingIds: string[]
  shouldSelect: boolean
  handleItemClick: (event: MouseEvent, item: IDoc, index: number, callback: () => void) => void
  handleMouseOver: (event: MouseEvent, index: number) => void
  toggleSelect: (event: MouseEvent, item: IDoc, index: number) => void
}>()

defineEmits<{
  'download-file': [path: string]
  'delete-item': [item: IDoc]
  'open-file': [item: IDoc]
  'rename-item': [item: IDoc]
  'duplicate-item': [item: IDoc]
}>()

function onIconError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src = '/ficons/default.svg'
}
</script>


