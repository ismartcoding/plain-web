<template>
  <div class="screen-mirror">
    <div class="top-app-bar">
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
        </template>
        <v-outlined-button v-else-if="!relaunchAppLoading" class="btn-sm" @click="relaunchApp">{{ $t('relaunch_app') }}</v-outlined-button>
      </div>
    </div>
    <div class="content">
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
      <video v-show="mirroring && !showLoading" ref="videoRef" class="video" controls="true" autoplay playsinline muted></video>
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

const modeLabels: Record<string, string> = {
  AUTO: 'mirror_auto',
  HD: 'mirror_hd',
  SMOOTH: 'mirror_smooth',
}
const modeLabel = computed(() => t(modeLabels[qualityMode.value] || 'mirror_auto'))

let webrtcClient: WebRTCClient | null = null
let pendingStream: MediaStream | null = null

const screenMirroringHandler = async () => {
  mirroring.value = true
  failed.value = false
  seconds.value = 0
  clearInterval(countIntervalId)
  startWebRTC()
}

const showLoading = computed(() =>  fetchStateLoading.value || startServiceLoading.value || relaunchAppLoading.value || connecting.value)

const refresh = () => {
  refetch()
}

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
  emitter.on('screen_mirroring', screenMirroringHandler)
  emitter.on('webrtc_signaling', webrtcSignalingHandler)
  emitter.on('app_socket_connection_changed', appSocketConnectionChangedHanlder)
  emitter.on('screen_mirror_audio_granted', screenMirrorAudioGrantedHandler)
  initWebRTCClient()
})

onDeactivated(() => {
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

const { loading: fetchStateLoading, refetch } = initQuery({
  handle: (data: { screenMirrorState: boolean; screenMirrorQuality?: { mode: string } }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data?.screenMirrorQuality?.mode) {
        qualityMode.value = data.screenMirrorQuality.mode
      }
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
  if (webrtcClient) {
    webrtcClient.cleanup()
  }
})
</script>
<style lang="scss" scoped>
.video {
  margin: 0 auto;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.content {
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100vh - 132px);
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
