<template>
  <section v-if="!isPhone" class="feed-item selectable-card-skeleton">
    <div class="title">
      <div class="skeleton-checkbox"></div>
      <div class="skeleton-text lg" style="width: 50%"></div>
    </div>
    <div class="subtitle">
      <span class="number">{{ index }}</span>
      <div class="info">
        <div class="skeleton-text" style="width: 30%"></div>
      </div>
    </div>
    <div class="image">
      <div class="skeleton-image lg"></div>
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
