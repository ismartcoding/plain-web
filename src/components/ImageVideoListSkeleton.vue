<template>
  <section class="media-item selectable-card-skeleton" v-for="i in props.limit" :key="i">
    <div class="start">
      <div class="checkbox">
        <div class="skeleton-checkbox"></div>
      </div>
      <span class="number">{{ i + 1 }}</span>
    </div>
    <div class="image">
      <div class="skeleton-image"></div>
    </div>
    <div class="title">
      <div class="skeleton-text skeleton-title"></div>
    </div>
    <div class="subtitle">
      <div class="skeleton-text skeleton-subtitle"></div>
    </div>
    <div class="actions">
      <div class="skeleton-text skeleton-actions"></div>
    </div>
    <div class="time">
      <div class="skeleton-text skeleton-time"></div>
    </div>
  </section>
</template>
<script setup lang="ts">
const props = defineProps({
  limit: { type: Number, required: true },
})
</script>
