<template>
  <li class="item session-list-item" :class="{ loading }" @click="selectSession">
    <div>
      <span class="title">{{ displayName }}</span>
      <span class="subtitle">{{ host }}</span>
    </div>
    <v-circular-progress v-if="loading" indeterminate class="sm icon" />
    <i-material-symbols:chevron-right-rounded v-else class="icon" />
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name?: string
  host: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'select'): void
}>()

const displayName = computed(() => props.name || props.host)

function selectSession() {
  if (props.loading) return
  emit('select')
}
</script>

<style lang="scss" scoped>
.session-list-item {
  cursor: pointer;
}

.session-list-item.loading {
  cursor: default;
  opacity: 0.7;
}
</style>
