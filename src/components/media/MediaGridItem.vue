<template>
  <section
    class="media-item"
    :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
    @click.stop="$emit('item-click', $event)"
    @mouseenter.stop="$emit('item-mouse-enter', $event)"
  >
    <slot name="thumbnail" />
    <v-icon-button class="btn-checkbox" @click.stop="$emit('toggle-select', $event)">
      <template v-if="shiftEffectingIds.includes(item.id)">
        <i-material-symbols:check-circle-rounded v-if="shouldSelect" />
        <i-material-symbols:check-circle-outline-rounded v-else />
      </template>
      <i-material-symbols:check-circle-rounded v-else-if="selectedIds.includes(item.id)" />
      <i-material-symbols:check-circle-outline-rounded v-else />
    </v-icon-button>
    <v-icon-button v-if="checked" v-tooltip="$t('open')" class="btn-zoom sm" @click.stop="$emit('view')">
      <i-material-symbols:zoom-in-rounded />
    </v-icon-button>
    <div class="info" :class="{ 'has-tags': item.tags.length > 0 }">
      <item-tags :tags="item.tags" :type="dataType" />
      <span class="right"><slot name="info-right" /></span>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DataType } from '@/lib/data'
import type { ITag } from '@/lib/interfaces'

defineProps<{
  item: { id: string; tags: ITag[] }
  checked: boolean
  selectedIds: string[]
  shiftEffectingIds: string[]
  shouldSelect: boolean
  dataType: DataType
}>()

defineEmits<{
  (e: 'item-click', event: MouseEvent): void
  (e: 'item-mouse-enter', event: MouseEvent): void
  (e: 'toggle-select', event: MouseEvent): void
  (e: 'view'): void
}>()
</script>
