<template>
  <section v-if="!isPhone" class="call-item selectable-card-skeleton">
    <div class="start">
      <div class="skeleton-checkbox"></div>
      <span class="number">{{ index }}</span>
    </div>
    <div class="title">
      <div class="skeleton-text lg" style="width: 160px"></div>
    </div>
    <div class="subtitle">
      <div class="skeleton-text" style="width: 80px"></div>
    </div>
    <div class="actions">
      <div class="skeleton-text lg" style="width: 120px"></div>
    </div>
    <div class="geo">
      <div class="skeleton-text" style="width: 100px"></div>
    </div>
    <div class="time">
      <div class="skeleton-text" style="width: 60px"></div>
    </div>
  </section>
  <SkeletonItemPhone v-else title-width="70%" :image="false" :subtitles="[{ width: '45%' }, { width: '30%' }]" :action-count="3" />
</template>

<script setup lang="ts">
interface Props {
  index: number
  isPhone: boolean
}

defineProps<Props>()
</script>
