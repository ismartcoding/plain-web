<template>
  <section
    v-if="!isPhone"
    class="note-item selectable-card"
    :class="{ selected: selectedIds.includes(item.id) || item.id == routeId, selecting: shiftEffectingIds.includes(item.id) }"
    @click.stop.prevent="handleItemClick($event, item, index, () => view(item))"
    @mouseenter.stop="handleMouseOver($event, index)"
  >
    <div class="start">
      <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, index)" />
      <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, index)" />
      <span class="number"><field-id :id="index + 1" :raw="item" /></span>
    </div>
    <div class="title">{{ getSummary(item.title.split('\n')[0].trimStart()) || $t('meta_no_title') }}</div>
    <div class="subtitle">
      <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
    </div>
    <div class="actions">
      <NoteActionButtons
        :item="item"
        :filter="filter"
        :delete-item="deleteItem"
        :add-item-to-tags="addItemToTags"
        :restore-loading="restoreLoading"
        :trash-loading="trashLoading"
        :restore="restore"
        :trash="trash"
      />
    </div>
    <div class="time">
      <span v-tooltip="formatDateTime(item.updatedAt)">
        {{ formatTimeAgo(item.updatedAt) }}
      </span>
    </div>
  </section>

  <!-- phone Layout -->
  <ListItemPhone
    v-else
    :is-selected="selectedIds.includes(item.id) || item.id == routeId"
    :is-selecting="shiftEffectingIds.includes(item.id)"
    :checkbox-checked="shiftEffectingIds.includes(item.id) ? shouldSelect : selectedIds.includes(item.id)"
    @click="handleItemClick($event, item, index, () => view(item))"
    @mouseenter.stop="handleMouseOver($event, index)"
    @checkbox-click="(event: MouseEvent) => toggleSelect(event, item, index)"
  >
    <template #title>{{ getSummary(item.title.split('\n')[0].trimStart()) || $t('meta_no_title') }}</template>

    <template #subtitle>
      <div v-if="item.tags.length > 0" class="subtitle">
        <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
      </div>
      <div class="subtitle">
        <span class="time">{{ formatTimeAgo(item.updatedAt) }}</span>
      </div>
    </template>

    <template #actions>
      <NoteActionButtons
        :item="item"
        :filter="filter"
        :delete-item="deleteItem"
        :add-item-to-tags="addItemToTags"
        :restore-loading="restoreLoading"
        :trash-loading="trashLoading"
        :restore="restore"
        :trash="trash"
      />
    </template>
  </ListItemPhone>
</template>

<script setup lang="ts">
import type { INote, IFilter } from '@/lib/interfaces'
import { DataType } from '@/lib/data'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import { getSummary } from '@/lib/strutil'
import NoteActionButtons from './NoteActionButtons.vue'

interface Props {
  item: INote
  index: number
  selectedIds: string[]
  shiftEffectingIds: string[]
  shouldSelect: boolean
  isPhone: boolean
  filter: IFilter
  dataType: DataType
  routeId?: string
  // Functions passed from parent
  handleItemClick: (event: MouseEvent, item: INote, index: number, callback: () => void) => void
  handleMouseOver: (event: MouseEvent, index: number) => void
  toggleSelect: (event: MouseEvent, item: INote, index: number) => void
  view: (item: INote) => void
  deleteItem: (item: INote) => void
  addItemToTags: (item: INote) => void
  restoreLoading: (query: string) => boolean
  trashLoading: (query: string) => boolean
  restore: (query: string) => void
  trash: (query: string) => void
}

defineProps<Props>()
</script>