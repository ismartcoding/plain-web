<template>
  <SidebarListItem :title="title" :subtitle="subtitle" :active="active" @click="emit('click')">
    <template #start>
      <span class="icon" :class="{ 'peer-icon': isPeer }" aria-hidden="true">
        <i-lucide:bot v-if="kind === 'local'" />
        <i-lucide:hash v-else-if="kind === 'channel'" />
        <template v-else>
          <i-lucide:smartphone v-if="deviceType === 'phone'" />
          <i-lucide:tablet v-else-if="deviceType === 'tablet'" />
          <i-lucide:laptop v-else-if="deviceType === 'pc'" />
          <i-lucide:monitor v-else />
        </template>
        <span v-if="isPeer && online" class="dot online-dot" />
      </span>
    </template>

    <template v-if="time" #end>
      <span v-tooltip="formatDateTime(time)" class="chat-time">{{ formatTimeAgo(time) }}</span>
    </template>
  </SidebarListItem>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDateTime, formatTimeAgo } from '@/lib/format'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    active?: boolean
    kind: 'local' | 'channel' | 'peer'
    deviceType?: string
    online?: boolean
    time?: string
  }>(),
  {
    subtitle: '',
    active: false,
    deviceType: '',
    online: false,
    time: '',
  },
)

const emit = defineEmits<{
  (e: 'click'): void
}>()

const isPeer = computed(() => props.kind === 'peer')
</script>

<style lang="scss" scoped>
.icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3ddc84;
}

.online-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
}

.chat-time {
  font-size: 0.75rem;
  opacity: 0.78;
}
</style>
