<!-- eslint-disable vue/no-v-html -->
<template>
  <section
    v-if="!isPhone"
    class="sms-item selectable-card"
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
      {{ item.address }}
    </div>
    <div class="subtitle" v-html="addLinksToURLs(item.body)"></div>
    <MessageActionButtons
      :item="item"
      :call-loading="callLoading"
      :call-id="callId"
      @add-item-to-tags="addItemToTags"
      @send-sms="sendSms"
      @call="call"
    />
    <div class="info">
      <span>{{ $t(`message_type.${item.type}`) }}</span>
      <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
    </div>
    <div class="time">
      <span v-tooltip="formatDateTime(item.date)">
        {{ formatTimeAgo(item.date) }}
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
    <template #title>{{ item.address }}</template>
    
    <template #subtitle>
      <div class="subtitle" v-html="addLinksToURLs(item.body)"></div>
      <div class="info">
        <span>{{ $t(`message_type.${item.type}`) }}</span>
        <item-tags :tags="item.tags" :type="dataType" :only-links="true" />
      </div>
      <div class="time">
        <span v-tooltip="formatDateTime(item.date)">
          {{ formatTimeAgo(item.date) }}
        </span>
      </div>
    </template>
    
    <template #actions>
      <MessageActionButtons
        :item="item"
        :call-loading="callLoading"
        :call-id="callId"
        @add-item-to-tags="addItemToTags"
        @send-sms="sendSms"
        @call="call"
      />
    </template>
  </ListItemPhone>
</template>

<script setup lang="ts">
import type { IMessage } from '@/lib/interfaces'
import { DataType } from '@/lib/data'
import { formatDateTime, formatTimeAgo } from '@/lib/format'
import { addLinksToURLs } from '@/lib/strutil'
import MessageActionButtons from './MessageActionButtons.vue'

interface Props {
  item: IMessage
  index: number
  selectedIds: string[]
  shiftEffectingIds: string[]
  shouldSelect: boolean
  isPhone: boolean
  dataType: DataType
  callLoading?: boolean
  callId?: string
  // Functions passed from parent
  handleItemClick: (event: MouseEvent, item: IMessage, index: number, callback: () => void) => void
  handleMouseOver: (event: MouseEvent, index: number) => void
  toggleSelect: (event: MouseEvent, item: IMessage, index: number) => void
}

defineProps<Props>()

const emit = defineEmits<{
  addItemToTags: [item: IMessage]
  sendSms: [item: IMessage]
  call: [item: IMessage]
}>()

function addItemToTags(item: IMessage) {
  emit('addItemToTags', item)
}

function call(item: IMessage) {
  emit('call', item)
}

function sendSms(item: IMessage) {
  emit('sendSms', item)
}
</script>

<style scoped lang="scss">
.main-list .list-item-phone {
  gap: 8px;
}
</style>