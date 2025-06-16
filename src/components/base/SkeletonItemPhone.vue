<template>
  <section class="skeleton-item-phone selectable-card-skeleton">
    <div class="phone-left">
      <div class="skeleton-checkbox"></div>
      <div class="skeleton-image"></div>
    </div>

    <div class="phone-content">
      <div class="title skeleton-text" :style="{ width: titleWidth }"></div>
      <div class="subtitle-container">
        <div v-for="(subtitle, index) in subtitles" :key="index" class="subtitle skeleton-text" :style="{ width: subtitle.width, height: subtitle.height || '16px' }"></div>
      </div>

      <div v-if="actionCount" class="actions">
        <div v-for="n in actionCount" :key="n" class="skeleton-action-square"></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface SkeletonItem {
  width: string
  height?: string
}

interface Props {
  titleWidth?: string
  subtitles?: SkeletonItem[]
  actionCount?: number
}

withDefaults(defineProps<Props>(), {
  titleWidth: '70%',
  subtitles: () => [{ width: '60%', height: '18px' }],
  actionCount: 0,
})
</script>

<style scoped lang="scss">
.skeleton-item-phone {
  display: flex;
  gap: 12px;
  border-radius: 8px;
  padding-block-end: 8px;
  padding-inline-end: 8px;
  margin-inline: 12px;

  .phone-left {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .skeleton-image {
      width: 40px;
      height: 40px;
      margin-inline-start: 12px;
    }
  }

  .phone-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title {
    margin-block-start: 12px;
    height: 20px;
  }

  .subtitle-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .subtitle {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }
}
</style>
