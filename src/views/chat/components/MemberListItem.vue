<template>
  <VListItem :subtitle="member.isSelf ? $t('this_device') : member.ip">
    <template #title>
      <span>{{ member.name }}</span>
      <span v-if="member.isOwner" class="status-badge on">{{ $t('creator') }}</span>
    </template>
    <template v-if="member.deviceType" #start>
      <i-lucide:smartphone v-if="member.deviceType === 'phone'" />
      <i-lucide:tablet v-else-if="member.deviceType === 'tablet'" />
      <i-lucide:laptop v-else-if="member.deviceType === 'pc'" />
      <i-lucide:monitor v-else />
    </template>
    <template #end>
      <span v-if="member.status === 'pending'" class="status-badge warn">{{ $t('member_pending') }}</span>
      <slot name="end" />
    </template>
  </VListItem>
</template>

<script setup lang="ts">
export interface IMemberListItem {
  id: string
  name: string
  ip?: string
  deviceType?: string
  isSelf: boolean
  isOwner: boolean
  status: string
}

defineProps<{
  member: IMemberListItem
}>()
</script>