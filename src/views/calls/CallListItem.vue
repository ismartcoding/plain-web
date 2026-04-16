<template>
  <section
    v-if="!isPhone"
    class="call-item selectable-card"
    :class="{ selected: selectedIds.includes(item.id), selecting: shiftEffectingIds.includes(item.id) }"
    @click.stop="handleItemClick($event, item, index, () => {})"
    @mouseenter.stop="handleMouseOver($event, index)"
  >
    <div class="start">
      <v-checkbox v-if="shiftEffectingIds.includes(item.id)" class="checkbox" touch-target="wrapper" :checked="shouldSelect" @click.stop="toggleSelect($event, item, index)" />
      <v-checkbox v-else class="checkbox" touch-target="wrapper" :checked="selectedIds.includes(item.id)" @click.stop="toggleSelect($event, item, index)" />
      <span class="number"><field-id :id="index + 1" :raw="item" /></span>
    </div>

    <div class="title">
      {{ item.name ? item.name + ' ' + item.number : item.number }}
    </div>
    <div class="subtitle">
      <span>{{ formatSeconds(item.duration) }}</span>
      <span>{{ $t('call_type.' + item.type) }}</span>
      <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
    </div>
    <CallActionButtons
      :item="item"
      :call-loading="callLoading"
      :call-id="callId"
      @delete-item="deleteItem"
      @call="call"
      @add-item-to-tags="addItemToTags"
    />
    <div class="geo">
      {{ getGeoText(item.geo) }}
    </div>
    <div class="time">
      <span v-tooltip="formatDateTime(item.startedAt)">
        {{ formatTimeAgo(item.startedAt) }}
      </span>
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
    <template #title>{{ item.name ? item.name + ' ' + item.number : item.number }}</template>
    
    <template #subtitle>
      <div class="subtitle">
        <span>{{ formatSeconds(item.duration) }}</span>
        <span>{{ $t('call_type.' + item.type) }}</span>
        <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
      </div>
      <div class="geo">
        {{ getGeoText(item.geo) }}
      </div>
      <div class="time">
        <span v-tooltip="formatDateTime(item.startedAt)">
          {{ formatTimeAgo(item.startedAt) }}
        </span>
      </div>
    </template>
    
    <template #actions>
      <CallActionButtons
        :item="item"
        :call-loading="callLoading"
        :call-id="callId"
        @delete-item="deleteItem"
        @call="call"
        @add-item-to-tags="addItemToTags"
      />
    </template>
  </ListItemPhone>
</template>

<script setup lang="ts">
import type { ICall, ICallGeo } from '@/lib/interfaces'
import { DataType } from '@/lib/data'
import { formatDateTime, formatSeconds, formatTimeAgo } from '@/lib/format'
import { useI18n } from 'vue-i18n'
import CallActionButtons from './CallActionButtons.vue'

interface Props {
  item: ICall
  index: number
  selectedIds: string[]
  shiftEffectingIds: string[]
  shouldSelect: boolean
  isPhone: boolean
  dataType: DataType
  callLoading?: boolean
  callId?: string
  // Functions passed from parent
  handleItemClick: (event: MouseEvent, item: ICall, index: number, callback: () => void) => void
  handleMouseOver: (event: MouseEvent, index: number) => void
  toggleSelect: (event: MouseEvent, item: ICall, index: number) => void
}

defineProps<Props>()

const { t } = useI18n()

const emit = defineEmits<{
  deleteItem: [item: ICall]
  call: [item: ICall]
  addItemToTags: [item: ICall]
}>()

function deleteItem(item: ICall) {
  emit('deleteItem', item)
}

function call(item: ICall) {
  emit('call', item)
}

function addItemToTags(item: ICall) {
  emit('addItemToTags', item)
}

function getGeoText(geo: ICallGeo | null | undefined) {
  if (!geo) {
    return ''
  }

  const texts = []
  if (geo.isp) {
    texts.push(t('phone_isp_type.' + geo.isp))
  }

  if (geo.city === geo.province) {
    texts.push(geo.city)
  } else {
    texts.push(`${geo.province}${geo.city}`)
  }

  return texts.join(', ')
}
</script>

<style scoped lang="scss">
.main-list .list-item-phone {
  gap: 8px;
}
</style> 