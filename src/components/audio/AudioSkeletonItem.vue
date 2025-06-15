<template>
  <!-- Desktop Layout -->
  <section
    v-if="!isPhone"
    class="media-item selectable-card-skeleton"
  >
    <div class="start">
      <div class="checkbox">
        <div class="skeleton-checkbox"></div>
      </div>
      <span class="number">{{ index }}</span>
    </div>
    <div class="image">
      <div class="skeleton-image"></div>
    </div>
    <div class="title">
      <div class="skeleton-text skeleton-title"></div>
    </div>
    <div class="audio-item-subtitle">
      <div class="skeleton-text skeleton-subtitle"></div>
    </div>
    <div class="actions">
      <div class="skeleton-text skeleton-actions"></div>
    </div>
    <div class="artist">
      <div class="skeleton-text skeleton-artist"></div>
    </div>
    <div class="time">
      <div class="skeleton-text skeleton-time"></div>
    </div>
  </section>

  <!-- Phone Layout -->
  <section
    v-else
    class="media-item-phone selectable-card-skeleton"
  >
    <div class="phone-left">
      <div class="checkbox">
        <div class="skeleton-checkbox"></div>
      </div>
      <div class="image">
        <div class="skeleton-image"></div>
      </div>
    </div>
    
    <div class="phone-content">
      <div class="title">
        <div class="skeleton-text skeleton-title"></div>
      </div>
      <div class="audio-item-subtitle">
        <div class="skeleton-text skeleton-subtitle"></div>
      </div>
      <div class="artist-time">
        <div class="skeleton-text skeleton-artist"></div>
        <div class="skeleton-text skeleton-time"></div>
      </div>
      <div class="actions">
        <div class="skeleton-text skeleton-actions"></div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  index: number
  isPhone: boolean
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.media-item-phone {
  display: flex;
  gap: 8px;
  border-radius: 8px;
  padding-block-end: 8px;
  padding-inline-end: 8px;
  
  .phone-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .image {
      width: 48px;
      height: 48px;
      margin-inline-start: 6px;
      
      .skeleton-image {
        width: 48px;
        height: 48px;
      }
    }
  }
  
  .phone-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .title {
    margin-block-start: 8px;
    
    .skeleton-title {
      width: 70%;
      height: 18px;
    }
  }
  
  .audio-item-subtitle {
    .skeleton-subtitle {
      width: 60%;
      height: 14px;
    }
  }
  
  .artist-time {
    display: flex;
    gap: 8px;
    
    .skeleton-artist {
      width: 80px;
      height: 14px;
    }
    
    .skeleton-time {
      width: 60px;
      height: 14px;
    }
  }
  
  .actions {
    .skeleton-actions {
      width: 120px;
      height: 16px;
    }
  }
}
</style>