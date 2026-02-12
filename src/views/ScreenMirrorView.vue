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
      </div>
    </Teleport>
    <Teleport v-if="isActive" to="#header-end-slot" defer>
      <div class="actions">
        <template v-if="mirroring">
          <v-icon-button v-tooltip="$t('refresh')" @click="refresh">
            <i-material-symbols:refresh-rounded />
          </v-icon-button>
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
        <video ref="videoRef" class="video" :controls="!controlEnabled" autoplay playsinline muted></video>
        <!-- Transparent overlay to capture input when control is enabled -->
        <div
          v-if="controlEnabled"
          ref="controlOverlayRef"
          class="control-overlay"
          tabindex="0"
        ></div>
      </div>
      <!-- Recording indicator -->
      <div v-if="recording" class="recording-indicator">
        <span class="recording-dot"></span>
        {{ $t('recording') }} {{ recordingTime }}
      </div>
      <!-- Navigation bar shown when control is enabled -->
      <div v-if="mirroring && !showLoading && controlEnabled" class="nav-bar">
        <button class="nav-btn" @click="sendNavAction('BACK')" :title="$t('nav_back')">
          <i-material-symbols:arrow-back-rounded />
        </button>
        <button class="nav-btn" @click="sendNavAction('HOME')" :title="$t('nav_home')">
          <i-material-symbols:circle-outline />
        </button>
        <button class="nav-btn" @click="sendNavAction('RECENTS')" :title="$t('nav_recents')">
          <i-material-symbols:crop-square-outline />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import emitter from '@/plugins/eventbus'
import toast from '@/components/toaster'
import tapPhone from '@/plugins/tapphone'
import { onActivated, onDeactivated, ref, watch, computed } from 'vue'
import MobileWarning from '@/assets/mobile-warning.svg'
import { initQuery, screenMirrorStateGQL } from '@/lib/api/query'
import { useI18n } from 'vue-i18n'
import { initMutation, relaunchAppGQL, startScreenMirrorGQL, stopScreenMirrorGQL, updateScreenMirrorQualityGQL, requestScreenMirrorAudioGQL } from '@/lib/api/mutation'
import type { ApolloError } from '@apollo/client/errors'
import TouchPhone from '@/assets/touch-phone.svg'
import { download } from '@/lib/api/file'
import { WebRTCClient, type SignalingMessage } from '@/lib/webrtc-client'
import { sendWebRTCSignaling } from '@/lib/webrtc-signaling'
import { hasFeature } from '@/lib/feature'
import { FEATURE } from '@/lib/data'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useScreenMirrorControl, type ScreenMirrorControlAction } from '@/hooks/screen-mirror-control'
import { openModal } from '@/components/modal'
import AccessibilityGuideModal from '@/components/AccessibilityGuideModal.vue'
import { useScreenRecording } from '@/hooks/screen-recording'

let countIntervalId: number
const { t } = useI18n()
const { app } = storeToRefs(useTempStore())
const mirroring = ref(false)
const seconds = ref(0)
const failed = ref(false)
const connecting = ref(false)
const videoRef = ref<HTMLVideoElement>()
const qualityMenuVisible = ref(false)
const qualityMode = ref('AUTO')
const audioRequesting = ref(false)
const controlEnabled = ref(false)
const controlOverlayRef = ref<HTMLDivElement>()
const accessibilityEnabled = ref(false)
const isActive = ref(false)

const modeLabels: Record<string, string> = {
  AUTO: 'mirror_auto',
  HD: 'mirror_hd',
  SMOOTH: 'mirror_smooth',
}
const modeLabel = computed(() => t(modeLabels[qualityMode.value] || 'mirror_auto'))

let webrtcClient: WebRTCClient | null = null
let pendingStream: MediaStream | null = null

const { attachOverlay, setupListeners, removeListeners, sendControl } = useScreenMirrorControl(videoRef, controlEnabled)
const { recording, recordingTime, toggleRecording } = useScreenRecording(videoRef)

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

const toggleControl = () => {
  if (controlEnabled.value) {
    controlEnabled.value = false
    return
  }
  // Check if accessibility service is enabled on the phone
  if (!accessibilityEnabled.value) {
    openModal(AccessibilityGuideModal, {
      onConfirm: () => {
        // User clicked OK — refresh state to re-check
        refresh()
      },
    })
    return
  }
  controlEnabled.value = true
}

// When overlay element appears/disappears, attach/detach listeners
watch(controlOverlayRef, (el) => {
  removeListeners()
  attachOverlay(el)
  if (el) {
    setupListeners()
  }
})

const screenMirroringHandler = async () => {
  mirroring.value = true
  failed.value = false
  seconds.value = 0
  clearInterval(countIntervalId)
  startWebRTC()
}

const showLoading = computed(() =>  fetchStateLoading.value || startServiceLoading.value || relaunchAppLoading.value || stopServiceLoading.value || connecting.value)

// When the video element appears in DOM, attach any pending stream
watch(videoRef, (video) => {
  if (video && pendingStream) {
    video.srcObject = pendingStream
    video.play().catch(() => undefined)
    pendingStream = null
  }
})

const { mutate: relaunchApp, loading: relaunchAppLoading } = initMutation({
  document: relaunchAppGQL,
})

const requestAudioPermission = () => {
  if (audioRequesting.value) return
  audioRequesting.value = true
  tapPhone(t('confirm_mirror_audio_permission_on_phone'))
  requestMirrorAudio()
}

const { mutate: requestMirrorAudio, onDone: requestMirrorAudioDone, onError: requestMirrorAudioError } = initMutation({
  document: requestScreenMirrorAudioGQL,
})

requestMirrorAudioError((error: ApolloError) => {
  audioRequesting.value = false
  tapPhone('')
  toast(t(error.message), 'error')
})

requestMirrorAudioDone((result: any) => {
  const alreadyGranted = result?.data?.requestScreenMirrorAudio
  if (alreadyGranted) {
    audioRequesting.value = false
    tapPhone('')
    emitter.emit('refetch_app')
  }
})

const screenMirrorAudioGrantedHandler = () => {
  audioRequesting.value = false
  tapPhone('')
  emitter.emit('refetch_app')
  refresh()
}

let pendingMode: string | null = null

const { mutate: updateQuality, loading: updateQualityLoading, onDone: updateQualityDone } = initMutation({
  document: updateScreenMirrorQualityGQL,
})

updateQualityDone(() => {
  if (pendingMode != null) {
    qualityMode.value = pendingMode
    pendingMode = null
  }
  qualityMenuVisible.value = false
})

const setQualityMode = (mode: string) => {
  pendingMode = mode
  updateQuality({ mode })
}

const appSocketConnectionChangedHanlder = (connected: boolean) => {
  if (connected) {
    if (relaunchAppLoading.value) {
      clearInterval(countIntervalId)
      start()
    }
  }
}

const takeScreenshot = () => {
  const video = videoRef.value
  if (!video) {
    return
  }
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }
  const d = new Date()
  const fileName = 'screenshot-' + [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()].join('') + '.png'
  download(canvas.toDataURL(), fileName)
}

const initWebRTCClient = () => {
  if (webrtcClient) {
    webrtcClient.cleanup()
  }

  webrtcClient = new WebRTCClient({
    sendSignaling: (message: SignalingMessage) => {
      sendWebRTCSignaling(message)
    },
    onStream: (stream: MediaStream) => {
      connecting.value = false
      const video = videoRef.value
      if (video) {
        video.srcObject = stream
        video.play().catch(() => undefined)
        mirroring.value = true
        failed.value = false
        seconds.value = 0
        clearInterval(countIntervalId)
      } else {
        // Video element not yet in DOM, store for later
        pendingStream = stream
        mirroring.value = true
        failed.value = false
        seconds.value = 0
        clearInterval(countIntervalId)
      }
    },
    onConnectionStateChange: (newState: RTCPeerConnectionState) => {
      if (newState === 'connected') {
        connecting.value = false
      } else if (newState === 'failed' || newState === 'disconnected') {
        connecting.value = false
        failed.value = true
      }
    },
    onError: (error: string) => {
      connecting.value = false
      toast(error, 'error')
      failed.value = true
    },
  })
}

const startWebRTC = () => {
  connecting.value = true
  // Act as answerer: wait for offer from app.
  webrtcClient?.startSession(true, false)
}

const webrtcSignalingHandler = async (message: SignalingMessage) => {
  if (webrtcClient) {
    await webrtcClient.handleSignalingMessage(message)
  }
}


onActivated(() => {
  isActive.value = true
  emitter.on('screen_mirroring', screenMirroringHandler)
  emitter.on('webrtc_signaling', webrtcSignalingHandler)
  emitter.on('app_socket_connection_changed', appSocketConnectionChangedHanlder)
  emitter.on('screen_mirror_audio_granted', screenMirrorAudioGrantedHandler)
  initWebRTCClient()
})

onDeactivated(() => {
  isActive.value = false
  emitter.off('screen_mirroring', screenMirroringHandler)
  emitter.off('webrtc_signaling', webrtcSignalingHandler)
  emitter.off('app_socket_connection_changed', appSocketConnectionChangedHanlder)
  emitter.off('screen_mirror_audio_granted', screenMirrorAudioGrantedHandler)
  if (webrtcClient) {
    webrtcClient.cleanup()
    webrtcClient = null
  }
})

const {
  mutate: startService,
  loading: startServiceLoading,
  onDone: startServiceDone,
  onError: startServiceError,
} = initMutation({
  document: startScreenMirrorGQL,
})

const { loading: fetchStateLoading, refetch: refresh } = initQuery({
  handle: (data: { screenMirrorState: boolean; screenMirrorControlEnabled?: boolean; screenMirrorQuality?: { mode: string } }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data?.screenMirrorQuality?.mode) {
        qualityMode.value = data.screenMirrorQuality.mode
      }
      accessibilityEnabled.value = data?.screenMirrorControlEnabled === true
      if (!data.screenMirrorState) {
        mirroring.value = false
        start()
      } else {
        startWebRTC()
      }
    }
  },
  options: {
    fetchPolicy: 'no-cache',
  },
  document: screenMirrorStateGQL,
})

const start = () => {
  failed.value = false
  startService({ audio: true })
}

startServiceError((error: ApolloError) => {
  toast(t(error.message))
  failed.value = true
})

startServiceDone(() => {
  seconds.value = 30
  countIntervalId = setInterval(() => {
    seconds.value--
    if (seconds.value <= 0) {
      failed.value = true
      clearInterval(countIntervalId)
    }
  }, 1000)
})

const {
  mutate: stopService,
  loading: stopServiceLoading,
  onDone: stopServiceDone,
  onError: stopServiceError,
} = initMutation({
  document: stopScreenMirrorGQL,
})

stopServiceError((error: ApolloError) => {
  toast(t(error.message))
})

stopServiceDone(() => {
  failed.value = true
  mirroring.value = false
  controlEnabled.value = false
  if (recording.value) {
    toggleRecording()
  }
  if (webrtcClient) {
    webrtcClient.cleanup()
  }
})
</script>
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
  cursor: crosshair;
  z-index: 10;
  touch-action: none;
  outline: none;

  // Subtle border to indicate control mode is active
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    border-radius: 4px;
  }
}

.recording-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--md-sys-color-error);
  flex-shrink: 0;
}

.recording-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--md-sys-color-error);
  animation: recording-blink 1s ease-in-out infinite;
}

@keyframes recording-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.btn-sm.active.recording-active {
  background: var(--md-sys-color-error);
  border-color: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
}

.nav-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  padding: 8px 0;
  flex-shrink: 0;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--md-sys-color-outline-variant);
  background: var(--md-sys-color-surface-container);
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
