<template>
  <div class="screen-mirror">
    <Teleport v-if="isActive" to="#header-start-slot" defer>
      <div class="title">
        {{ $t('screen_mirror') }}
        <template v-if="mirroring">
          <div v-if="!hasFeature(FEATURE.MIRROR_AUDIO, app.osVersion)" class="warning-indicator">
            <popper>
              <button class="btn-icon warning-icon">
                <i-material-symbols:warning-outline />
              </button>
              <template #content>
                <div class="warning-dropdown">
                  <div class="warning-content">
                    <i-material-symbols:error-outline-rounded />
                    <div class="warning-text">
                      {{ $t('mirror_audio_not_supported') }}
                    </div>
                  </div>
                </div>
              </template>
            </popper>
          </div>
          <div v-else-if="!app.permissions.includes('RECORD_AUDIO')" class="warning-indicator">
            <popper>
              <button class="btn-icon warning-icon">
                <i-material-symbols:warning-outline />
              </button>
              <template #content>
                <div class="warning-dropdown">
                  <div class="warning-content">
                    <i-material-symbols:error-outline-rounded />
                    <div class="warning-text">
                      {{ $t('mirror_audio_no_permission') }}
                    </div>
                  </div>
                  <div class="warning-actions">
                    <v-filled-button class="btn-sm" :loading="audioRequesting" @click="requestAudioPermission">
                      {{ $t('grant_permission') }}
                    </v-filled-button>
                  </div>
                </div>
              </template>
            </popper>
          </div>
        </template>
        <div v-if="mirroring && !showLoading" class="media-controls">
          <v-icon-button v-tooltip="paused ? $t('play') : $t('pause')" @click="togglePlay">
            <i-material-symbols:play-arrow-rounded v-if="paused" />
            <i-material-symbols:pause-rounded v-else />
          </v-icon-button>
          <v-icon-button v-tooltip="isFullscreen ? $t('exit_fullscreen') : $t('fullscreen')" @click="toggleFullscreen">
            <i-material-symbols:fullscreen-exit-rounded v-if="isFullscreen" />
            <i-material-symbols:fullscreen-rounded v-else />
          </v-icon-button>
          <v-icon-button v-tooltip="muted ? $t('unmute') : $t('mute')" @click="toggleMute">
            <i-material-symbols:volume-off-rounded v-if="muted" />
            <i-material-symbols:volume-up-rounded v-else />
          </v-icon-button>
          <template v-if="controlEnabled" >
          <v-icon-button v-tooltip="$t('nav_back')" @click="sendNavAction('BACK')">
            <i-material-symbols:arrow-back-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('nav_home')" @click="sendNavAction('HOME')">
            <i-material-symbols:circle-outline />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('nav_recents')" @click="sendNavAction('RECENTS')">
            <i-material-symbols:crop-square-outline />
          </v-icon-button>
        </template>
        </div>
      </div>
    </Teleport>
    <Teleport v-if="isActive" to="#header-end-slot" defer>
      <div class="actions">
        <template v-if="mirroring">
          <v-icon-button v-tooltip="$t('stop_mirror')" :disabled="stopServiceLoading" class="btn-stop" @click="stopService">
            <i-material-symbols:stop-rounded />
          </v-icon-button>

          <v-dropdown v-model="qualityMenuVisible" placement="auto" align="top-left-to-bottom-left">
            <template #trigger>
              <v-outlined-button v-tooltip="$t('mirror_quality')" class="btn-sm" :loading="updateQualityLoading">
                {{ modeLabel }}
              </v-outlined-button>
            </template>
            <div class="dropdown-item" :class="{ active: qualityMode === 'AUTO' }" @click="() => setQualityMode('AUTO')">
              <i-material-symbols:check-rounded v-if="qualityMode === 'AUTO'" />
              <span v-else class="check-placeholder" />
              {{ $t('mirror_auto') }}
            </div>
            <div class="dropdown-item" :class="{ active: qualityMode === 'HD' }" @click="() => setQualityMode('HD')">
              <i-material-symbols:check-rounded v-if="qualityMode === 'HD'" />
              <span v-else class="check-placeholder" />
              {{ $t('mirror_hd') }}
            </div>
            <div class="dropdown-item" :class="{ active: qualityMode === 'SMOOTH' }" @click="() => setQualityMode('SMOOTH')">
              <i-material-symbols:check-rounded v-if="qualityMode === 'SMOOTH'" />
              <span v-else class="check-placeholder" />
              {{ $t('mirror_smooth') }}
            </div>
          </v-dropdown>

          <v-outlined-button v-tooltip="$t('screenshot')" class="btn-sm" @click="takeScreenshot">{{ $t('screenshot') }}</v-outlined-button>

          <v-outlined-button
            v-tooltip="recording ? $t('stop_recording') : $t('start_recording')"
            class="btn-sm"
            :class="{ active: recording }"
            @click="toggleRecording"
          >
            <i-material-symbols:fiber-manual-record v-if="!recording" />
            <i-material-symbols:stop-rounded v-else />
            {{ recording ? recordingTime : $t('start_recording') }}
          </v-outlined-button>

          <v-outlined-button
            v-if="app.channel !== 'GOOGLE'"
            v-tooltip="controlEnabled ? $t('disable_control') : $t('enable_control')"
            class="btn-sm"
            :class="{ active: controlEnabled }"
            @click="toggleControl"
          >
            <i-material-symbols:touch-app-rounded />
            {{ $t('remote_control') }}
          </v-outlined-button>

          <keyboard-shortcuts :shortcuts="mirrorShortcuts" />
        </template>
        <v-outlined-button v-else-if="!relaunchAppLoading" class="btn-sm" @click="relaunchApp">{{ $t('relaunch_app') }}</v-outlined-button>
      </div>
    </Teleport>
    <div class="content" :class="{ 'content-centered': !mirroring || showLoading || !controlEnabled }">
      <div v-if="showLoading">
        <v-circular-progress indeterminate />
      </div>
      <template v-else>
        <div v-if="seconds > 0" class="request-permission">
          <div class="tap-phone">
            <TouchPhone />
          </div>
          <pre class="text">{{ $t('screen_mirror_request_permission', { seconds: seconds }) }}</pre>
        </div>
        <div v-if="failed && !mirroring" class="request-permission-failed">
          <MobileWarning />
          <p>{{ $t('screen_mirror_request_permission_failed') }}</p>
          <v-filled-button @click="start">{{ $t('try_again') }}</v-filled-button>
        </div>
      </template>
      <div v-show="mirroring && !showLoading" class="video-wrapper">
        <video ref="videoRef" class="video" autoplay playsinline muted></video>
        <!-- Transparent overlay to capture input when control is enabled -->
        <div
          v-if="controlEnabled"
          ref="controlOverlayRef"
          class="control-overlay"
          tabindex="0"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import emitter from '@/plugins/eventbus'
import { onActivated, onDeactivated, ref, watch } from 'vue'
import MobileWarning from '@/assets/mobile-warning.svg'
import TouchPhone from '@/assets/touch-phone.svg'
import { hasFeature } from '@/lib/feature'
import { FEATURE } from '@/lib/data'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useScreenMirrorControl, type ScreenMirrorControlAction } from '@/hooks/screen-mirror-control'
import { useScreenRecording } from '@/hooks/screen-recording'
import { useScreenMirrorMedia } from '@/hooks/screen-mirror-media'
import { useScreenMirrorWebRTC } from '@/hooks/screen-mirror-webrtc-session'
import { useScreenMirrorService } from '@/hooks/screen-mirror-service'

const { app } = storeToRefs(useTempStore())
const mirroring = ref(false)
const failed = ref(false)
const connecting = ref(false)
const videoRef = ref<HTMLVideoElement>()
const controlOverlayRef = ref<HTMLDivElement>()
const isActive = ref(false)

const { recording, recordingTime, toggleRecording } = useScreenRecording(videoRef)
const { paused, muted, isFullscreen, togglePlay, toggleMute, toggleFullscreen, onFullscreenChange, takeScreenshot } = useScreenMirrorMedia(videoRef)

const {
  seconds, qualityMenuVisible, qualityMode, audioRequesting, controlEnabled,
  modeLabel, clearCountInterval, relaunchApp, relaunchAppLoading,
  stopService, stopServiceLoading, updateQualityLoading, setQualityMode,
  requestAudioPermission, start, showLoading: serviceLoading,
  toggleControl, screenMirroringHandler, appSocketConnectionChangedHandler, screenMirrorAudioGrantedHandler,
} = useScreenMirrorService(mirroring, failed, recording, toggleRecording, () => startWebRTC(), () => cleanupWebRTC())

const { attachOverlay, setupListeners, removeListeners, sendControl } = useScreenMirrorControl(videoRef, controlEnabled)

const { pendingStream, initWebRTCClient, startWebRTC, webrtcSignalingHandler, cleanupWebRTC } =
  useScreenMirrorWebRTC(videoRef, mirroring, failed, seconds, connecting, clearCountInterval)

const showLoading = ref(false)
watch([serviceLoading, connecting], () => {
  showLoading.value = serviceLoading.value || connecting.value
})

const mirrorShortcuts = [
  { keys: ['Click'], description: 'mirror_tap' },
  { keys: ['Click', '+', 'Drag'], description: 'mirror_swipe' },
  { keys: ['Scroll'], description: 'mirror_scroll' },
  { keys: ['Long press'], description: 'mirror_long_press' },
  { keys: ['Esc'], description: 'nav_back' },
  { keys: ['Backspace'], description: 'nav_back' },
  { keys: ['Home'], description: 'nav_home' },
]

const sendNavAction = (action: Extract<ScreenMirrorControlAction, 'BACK' | 'HOME' | 'RECENTS' | 'LOCK_SCREEN'>) => {
  sendControl({ action })
}

watch(controlOverlayRef, (el) => {
  removeListeners()
  attachOverlay(el)
  if (el) setupListeners()
})

watch(videoRef, (video) => {
  if (video && pendingStream.value) {
    video.srcObject = pendingStream.value
    video.play().catch(() => undefined)
    pendingStream.value = null
  }
})

onActivated(() => {
  isActive.value = true
  emitter.on('screen_mirroring', screenMirroringHandler)
  emitter.on('webrtc_signaling', webrtcSignalingHandler)
  emitter.on('app_socket_connection_changed', appSocketConnectionChangedHandler)
  emitter.on('screen_mirror_audio_granted', screenMirrorAudioGrantedHandler)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  initWebRTCClient()
})

onDeactivated(() => {
  isActive.value = false
  emitter.off('screen_mirroring', screenMirroringHandler)
  emitter.off('webrtc_signaling', webrtcSignalingHandler)
  emitter.off('app_socket_connection_changed', appSocketConnectionChangedHandler)
  emitter.off('screen_mirror_audio_granted', screenMirrorAudioGrantedHandler)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  cleanupWebRTC()
})
</script>
<style lang="scss" src="@/styles/screen-mirror.scss"></style>
<style lang="scss" scoped>
.title {
  flex: 1;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions {
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
}

.video-wrapper {
  position: relative;
  width: 100%;
  height: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.video {
  margin: 0 auto;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.control-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: default;
  z-index: 10;
  touch-action: none;
  outline: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.btn-sm.active.recording-active {
  background: var(--md-sys-color-error);
  border-color: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
}

.media-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--md-sys-color-on-surface);
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;

  &:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  &:active {
    transform: scale(0.92);
  }

  i,
  svg {
    width: 24px;
    height: 24px;
  }
}

.btn-sm.active {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: var(--md-sys-color-primary);
}

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

.btn-exit-fullscreen,
.dropdown-item.exit-fullscreen {
  display: none;
}

.request-permission {
  padding-bottom: 40px;
  text-align: center;

  .tap-phone {
    width: 200px;
    margin: 0 auto 20px auto;
    *:is(svg) {
      fill: var(--md-sys-color-primary);
    }
  }

  .text {
    text-align: center;
    font-size: 1.2rem;
    line-height: 2;
    margin: 16px;
  }
}

.request-permission-failed {
  text-align: center;
  font-size: 1.2rem;
  line-height: 2;
  margin: 16px;

  *:is(svg) {
    width: 140px;
    display: block;
    fill: currentColor;
    margin: 0 auto 20px auto;
  }
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  color: var(--md-sys-color-on-surface);
  transition: background-color 0.15s ease;

  &:hover {
    background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
  }

  &.active {
    color: var(--md-sys-color-primary);
  }

  i {
    width: 20px;
    height: 20px;
  }

  .check-placeholder {
    display: inline-block;
    width: 20px;
    height: 20px;
  }
}
</style>
