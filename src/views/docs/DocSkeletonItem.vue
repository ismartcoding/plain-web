<template>
  <section class="doc-item selectable-card-skeleton">
    <div class="start">
      <div class="skeleton-checkbox checkbox"></div>
      <span class="number">{{ index }}</span>
    </div>
    <div class="doc-icon">
      <div class="skeleton-image" style="width: 32px; height: 32px; border-radius: 4px"></div>
    </div>
    <div class="title">
      <div class="skeleton-text lg" style="width: 40%"></div>
    </div>
    <div class="subtitle">
      <div class="skeleton-text" style="width: 30%"></div>
    </div>
    <div class="actions">
      <div class="skeleton-text lg" style="width: 120px"></div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ index: number }>()
</script>
