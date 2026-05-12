<template>
  <li class="item discover-item" :class="{ disabled }" @click="selectItem">
    <span class="title">{{ name }}</span>
    <span class="subtitle">{{ host }}</span>
    <i-material-symbols:chevron-right-rounded class="icon" />
  </li>
</template>

<script setup lang="ts">
const props = defineProps<{
  name: string
  host: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'select'): void
}>()

function selectItem() {
  if (props.disabled) return
  emit('select')
}
</script>

<style lang="scss" scoped>
.discover-item {
  cursor: pointer;
}

.discover-item.disabled {
  cursor: default;
  opacity: 0.5;
}
</style>
