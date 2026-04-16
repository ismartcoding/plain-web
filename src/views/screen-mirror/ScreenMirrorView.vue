<template>
  <div class="screen-mirror">
    <Teleport v-if="isActive" to="#header-start-slot" defer>
      <ScreenMirrorHeaderStart
        :mirroring="mirroring"
        :audio-requesting="audioRequesting"
        :os-version="app.osVersion"
        :permissions="app.permissions"
        @request-audio-permission="requestAudioPermission"
      />
    </Teleport>

    <Teleport v-if="isActive" to="#header-end-slot" defer>
      <ScreenMirrorHeaderActions
        :mirroring="mirroring"
        :idle="idle"
        :show-loading="showLoading"
        :stop-service-loading="stopServiceLoading"
        :quality-mode="qualityMode"
        :recording="recording"
        :recording-time="recordingTime"
        :control-enabled="controlEnabled"
        :relaunch-app-loading="relaunchAppLoading"
        :channel="app.channel"
        :paused="paused"
        :is-fullscreen="isFullscreen"
        :muted="muted"
        @stop-service="stopService"
        @set-quality-mode="setQualityMode"
        @take-screenshot="takeScreenshot"
        @toggle-recording="toggleRecording"
        @toggle-control="toggleControl"
        @relaunch-app="relaunchApp"
        @toggle-play="togglePlay"
        @toggle-fullscreen="toggleFullscreen"
        @toggle-mute="toggleMute"
        @nav="sendNavAction"
      />
    </Teleport>

    <ScreenMirrorContent
      :show-loading="showLoading"
      :idle="idle"
      :seconds="seconds"
      :failed="failed"
      :mirroring="mirroring"
      :control-enabled="controlEnabled"
      :set-video-ref="setVideoRef"
      :set-control-overlay-ref="setControlOverlayRef"
      @start="start"
    />
  </div>
</template>

<script setup lang="ts">
import ScreenMirrorContent from './ScreenMirrorContent.vue'
import ScreenMirrorHeaderActions from './ScreenMirrorHeaderActions.vue'
import ScreenMirrorHeaderStart from './ScreenMirrorHeaderStart.vue'
import { useScreenMirrorView } from './use-screen-mirror-view'

const {
  app,
  isActive,
  idle,
  mirroring,
  failed,
  setVideoRef,
  setControlOverlayRef,
  showLoading,
  paused,
  muted,
  isFullscreen,
  audioRequesting,
  controlEnabled,
  qualityMode,
  seconds,
  recording,
  recordingTime,
  relaunchAppLoading,
  stopServiceLoading,
  togglePlay,
  toggleFullscreen,
  toggleMute,
  requestAudioPermission,
  sendNavAction,
  stopService,
  setQualityMode,
  takeScreenshot,
  toggleRecording,
  toggleControl,
  relaunchApp,
  start,
} = useScreenMirrorView()
</script>

<style lang="scss" src="@/styles/screen-mirror.scss"></style>
