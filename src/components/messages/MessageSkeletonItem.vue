<template>
  <section v-if="!isPhone" class="sms-item selectable-card-skeleton">
    <div class="list-item-start">
      <div class="skeleton-checkbox"></div>
      <span class="number">{{ index }}</span>
    </div>
    <div class="title">
      <div class="skeleton-text lg" style="width: 120px"></div>
    </div>
    <div class="subtitle">
      <div class="skeleton-text" style="width: 80%"></div>
      <div class="skeleton-text" style="width: 80%; margin-block-start: 8px"></div>
    </div>
    <div class="actions">
      <div class="skeleton-text" style="width: 140px"></div>
    </div>
    <div class="info">
      <div class="skeleton-text" style="width: 60px"></div>
    </div>
    <div class="time">
      <div class="skeleton-text" style="width: 60px"></div>
    </div>
  </section>
  <SkeletonItemPhone v-else title-width="70%" :subtitles="[{ width: '45%' }, { width: '30%' }, { width: '40%' }]" :action-count="3" />
</template>

<script setup lang="ts">
interface Props {
  index: number
  isPhone: boolean
}

defineProps<Props>()
</script>
