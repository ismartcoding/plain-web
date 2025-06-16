<template>
  <template v-for="i in props.limit" :key="i">
    <section v-if="!isPhone" class="media-item selectable-card-skeleton">
      <div class="list-item-start">
        <div class="skeleton-checkbox"></div>
        <span class="number">{{ i }}</span>
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
        <div class="skeleton-text lg" style="width: 120px"></div>
      </div>
      <div class="time">
        <div class="skeleton-text" style="width: 60px"></div>
      </div>
    </section>
    <SkeletonItemPhone v-else title-width="70%" :subtitles="[{ width: '45%' }, { width: '40%' }]" :action-count="3" />
  </template>
</template>
<script setup lang="ts">
interface Props {
  limit: number
  isPhone?: boolean
}

const props = defineProps<Props>()
</script>
