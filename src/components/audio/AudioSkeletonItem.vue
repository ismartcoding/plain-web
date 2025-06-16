<template>
  <section v-if="!isPhone" class="media-item selectable-card-skeleton">
    <div class="list-item-start">
      <div class="skeleton-checkbox"></div>
      <span class="number">{{ index }}</span>
    </div>
    <div class="image">
      <div class="skeleton-image lg"></div>
    </div>
    <div class="title">
      <div class="skeleton-text lg" style="width: 40%"></div>
    </div>
    <div class="subtitle">
      <div class="skeleton-text" style="width: 30%"></div>
    </div>
    <div class="list-item-actions">
      <div class="skeleton-text lg" style="width: 140px"></div>
    </div>
    <div class="artist">
      <div class="skeleton-text" style="width: 60px"></div>
    </div>
    <div class="time">
      <div class="skeleton-text" style="width: 60px"></div>
    </div>
  </section>

  <SkeletonItemPhone v-else title-width="70%" :subtitles="[{ width: '45%' }, { width: '40%' }, { width: '50%' }]" :action-count="4" />
</template>

<script setup lang="ts">
interface Props {
  index: number
  isPhone: boolean
}

defineProps<Props>()
</script>
