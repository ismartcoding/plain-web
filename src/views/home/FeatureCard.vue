<template>
  <router-link :to="to" class="card feature-card">
    <div class="card-icon">
      <slot name="icon" />
    </div>
    <div class="card-content">
      <div class="card-title-row">
        <span v-if="count !== undefined && count >= 0" class="count">{{ count.toLocaleString() }}</span>
        <span class="title">{{ title }}</span>
      </div>
      <slot />
    </div>
  </router-link>
</template>

<script setup lang="ts">
defineProps<{
  to: string
  title: string
  count?: number
}>()
</script>
