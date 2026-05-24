<template>
  <div class="main-list" :class="{ 'select-mode': checked }">
    <div v-for="(item, i) in items" :id="`message-item-${item.id}`" :key="item.id">
      <MessageListItem
        :item="item"
        :index="i"
        :selected-ids="selectedIds"
        :shift-effecting-ids="shiftEffectingIds"
        :should-select="shouldSelect"
        :is-phone="isPhone"
        :data-type="dataType"
        :tags="tags"
        :call-loading="callLoading"
        :call-id="callId"
        :handle-item-click="handleItemClick"
        :handle-mouse-over="handleMouseOver"
        :toggle-select="toggleSelect"
        :on-view="onView"
        @send-sms="sendSms"
        @call="call"
        @archive="archive"
      />
    </div>
    <template v-if="loading && items.length === 0">
      <MessageSkeletonItem v-for="i in 20" :key="i" :index="i" :is-phone="isPhone" />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { IMessage, ITag } from '@/lib/interfaces'
import { DataType } from '@/lib/data'

interface Props {
  items: IMessage[]
  tags: ITag[]
  loading: boolean
  checked: boolean
  selectedIds: string[]
  shiftEffectingIds: string[]
  shouldSelect: boolean
  isPhone: boolean
  dataType: DataType
  callLoading?: boolean
  callId?: string
  handleItemClick: (event: MouseEvent, item: IMessage, index: number, callback: () => void) => void
  handleMouseOver: (event: MouseEvent, index: number) => void
  toggleSelect: (event: MouseEvent, item: IMessage, index: number) => void
}

const props = defineProps<Props>()

const emit = defineEmits<{
  sendSms: [item: IMessage]
  call: [item: IMessage]
  viewItem: [item: IMessage]
  archive: [item: IMessage]
}>()

function sendSms(item: IMessage) {
  emit('sendSms', item)
}

function call(item: IMessage) {
  emit('call', item)
}

function archive(item: IMessage) {
  emit('archive', item)
}

function onView(index: number) {
  const item = props.items[index]
  if (item) {
    emit('viewItem', item)
  }
}
</script>
