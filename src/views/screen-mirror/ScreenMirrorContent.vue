<template>
  <div class="content" :class="{ 'content-centered': !mirroring || showLoading }">
    <div v-if="showLoading"><v-circular-progress indeterminate /></div>
    <template v-else>
      <div v-if="idle && !mirroring && !failed" class="idle-screen">
        <button class="start-button" @click="$emit('start')">
          <i-material-symbols:cast-rounded class="start-icon" />
        </button>
        <p class="idle-title">{{ $t('screen_mirror') }}</p>
        <p class="idle-hint">{{ $t('screen_mirror_idle_hint') }}</p>
      </div>
      <div v-else-if="seconds > 0" class="prompt-screen">
        <div class="prompt-icon"><TouchPhone /></div>
        <p class="prompt-title">{{ $t('screen_mirror_permission_waiting_title') }}</p>
        <p class="prompt-hint">{{ $t('screen_mirror_permission_waiting_hint') }}</p>
        <p class="prompt-countdown">{{ seconds }}s</p>
      </div>
      <div v-if="failed && !mirroring" class="prompt-screen">
        <div class="prompt-icon prompt-icon--warning"><MobileWarning /></div>
        <p class="prompt-title">{{ $t('screen_mirror_permission_denied_title') }}</p>
        <p class="prompt-hint">{{ $t('screen_mirror_permission_denied_hint') }}</p>
        <v-filled-button @click="$emit('start')">{{ $t('try_again') }}</v-filled-button>
      </div>
    </template>

    <div v-show="mirroring && !showLoading" class="video-wrapper">
      <video :ref="setVideoRef" class="video" autoplay playsinline muted></video>
      <div v-if="controlEnabled" :ref="setControlOverlayRef" class="control-overlay" tabindex="0"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

defineProps<{
  showLoading: boolean
  idle: boolean
  seconds: number
  failed: boolean
  mirroring: boolean
  controlEnabled: boolean
  setVideoRef: (el: Element | ComponentPublicInstance | null) => void
  setControlOverlayRef: (el: Element | ComponentPublicInstance | null) => void
}>()


defineEmits<{ (e: 'start'): void }>()
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--pl-top-app-bar-height));
  overflow: hidden;

  &.content-centered {
    justify-content: center;
    align-items: center;
  }
}

.video-wrapper { position: relative; width: 100%; height: 0; flex: 1 1 auto; min-height: 0; overflow: hidden; }
.video { margin: 0 auto; display: block; width: 100%; height: 100%; object-fit: contain; }

.control-overlay {
  position: absolute;
  inset: 0;
  cursor: default;
  z-index: 10;
  touch-action: none;
  outline: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.prompt-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-bottom: 80px;
}

.prompt-icon {
  width: 240px;
  margin-bottom: 8px;
  :deep(svg) { fill: var(--md-sys-color-primary); width: 100%; height: auto; }
  &--warning :deep(svg) { fill: var(--md-sys-color-on-surface-variant); }
}

.prompt-title { font-size: 1.2rem; font-weight: 500; color: var(--md-sys-color-on-surface); margin: 0; }
.prompt-hint { font-size: 0.9rem; color: var(--md-sys-color-on-surface-variant); margin: 0; text-align: center;  line-height: 1.5; }
.prompt-countdown { font-size: 2rem; font-weight: 600; color: var(--md-sys-color-primary); margin: 4px 0 0; }

.idle-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-bottom: 80px;
}

.start-button {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: none;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 24px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);

  &:hover {
    transform: scale(1.06);
    box-shadow: 0 6px 32px color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent);
  }

  &:active { transform: scale(0.97); }
}

.start-icon { font-size: 48px; }

.idle-title {
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  margin: 0;
}

.idle-hint {
  font-size: 0.9rem;
  color: var(--md-sys-color-on-surface-variant);
  margin: 0;
}
</style>
