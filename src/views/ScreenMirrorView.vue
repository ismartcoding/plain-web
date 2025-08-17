<template>
  <div class="screen-mirror">
    <div class="top-app-bar">
      <div class="title">{{ $t('screen_mirror') }}</div>
      <div class="actions">
        <template v-if="state">
          <v-icon-button v-tooltip="$t('refresh')" @click="() => refetch()">
            <i-material-symbols:refresh-rounded />
          </v-icon-button>
          <v-icon-button v-tooltip="$t(paused ? 'resume' : 'pause')" @click="togglePause">
            <i-material-symbols:play-arrow-rounded v-if="paused" />
            <i-material-symbols:pause-rounded v-else />
          </v-icon-button>
          <v-icon-button v-tooltip="$t('stop_mirror')" :disabled="stopServiceLoading" class="btn-stop" @click="stopService">
            <i-material-symbols:stop-rounded />
          </v-icon-button>
          <template v-if="!isPhone">
            <v-outlined-button v-tooltip="$t('change_quality')" class="btn-sm" @click="changeQuality">{{ $t('mirror_quality') }}</v-outlined-button>
            <v-outlined-button v-tooltip="$t('screenshot')" class="btn-sm" @click="takeScreenshot">{{ $t('screenshot') }}</v-outlined-button>
            <v-icon-button v-tooltip="$t('fullscreen')" class="btn-enter-fullscreen" @click="requestFullscreen">
              <i-material-symbols:fullscreen-rounded />
            </v-icon-button>
            <v-icon-button v-tooltip="$t('exit_fullscreen')" class="btn-exit-fullscreen" @click="exitFullscreen">
              <i-material-symbols:fullscreen-exit-rounded />
            </v-icon-button>
          </template>
          <v-dropdown v-if="isPhone" v-model="moreMenuVisible">
            <template #trigger>
              <v-icon-button v-tooltip="$t('settings')">
                <i-material-symbols:more-vert />
              </v-icon-button>
            </template>
            <div class="dropdown-item" @click="changeQuality(); moreMenuVisible = false">
              <i-material-symbols:tune-rounded />
              {{ $t('mirror_quality') }}
            </div>
            <div class="dropdown-item" @click="takeScreenshot(); moreMenuVisible = false">
              <i-material-symbols:photo-camera-rounded />
              {{ $t('screenshot') }}
            </div>
            <div class="dropdown-item enter-fullscreen" @click="requestFullscreen(); moreMenuVisible = false">
              <i-material-symbols:fullscreen-rounded />
              {{ $t('fullscreen') }}
            </div>
            <div class="dropdown-item exit-fullscreen" @click="exitFullscreen(); moreMenuVisible = false">
              <i-material-symbols:fullscreen-exit-rounded />
              {{ $t('exit_fullscreen') }}
            </div>
          </v-dropdown>
        </template>
        <v-outlined-button v-else-if="!relaunchAppLoading" class="btn-sm" @click="relaunchApp">{{ $t('relaunch_app') }}</v-outlined-button>
      </div>
    </div>
    <div class="content">
      <div v-if="fetchImageLoading || startServiceLoading || relaunchAppLoading">
        <v-circular-progress indeterminate />
      </div>
      <template v-else>
        <div v-if="seconds > 0 && !relaunchAppLoading" class="request-permission">
          <div class="tap-phone">
            <TouchPhone />
          </div>
          <pre class="text">{{ $t('screen_mirror_request_permission', { seconds: seconds }) }}</pre>
        </div>
        <div v-if="failed && !state && !relaunchAppLoading" class="request-permission-failed">
          <MobileWarning />
          <p>{{ $t('screen_mirror_request_permission_failed') }}</p>
          <v-filled-button @click="start">{{ $t('try_again') }}</v-filled-button>
        </div>
        <canvas v-show="state" ref="canvasRef" class="canvas"></canvas>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import emitter from '@/plugins/eventbus'
import toast from '@/components/toaster'
import { onActivated, onDeactivated, ref, inject } from 'vue'
import MobileWarning from '@/assets/mobile-warning.svg'
import { initQuery, screenMirrorStateGQL } from '@/lib/api/query'
import { useI18n } from 'vue-i18n'
import { initMutation, relaunchAppGQL, startScreenMirrorGQL, stopScreenMirrorGQL } from '@/lib/api/mutation'
import type { ApolloError } from '@apollo/client/errors'
import TouchPhone from '@/assets/touch-phone.svg'
import ChangeScreenMirrorQualityModal from '@/components/ChangeScreenMirrorQualityModal.vue'
import { openModal } from '@/components/modal'
import { download } from '@/lib/api/file'

let countIntervalId: number
const { t } = useI18n()
const isPhone = inject('isPhone') as boolean
const state = ref(false)
const seconds = ref(0)
const failed = ref(false)
const paused = ref(false)
const showLatest = ref(false)
const canvasRef = ref<HTMLCanvasElement>()
const moreMenuVisible = ref(false)

const screenMirroringHandler = async (data: Blob) => {
  state.value = true
  renderCanvas(data)
  failed.value = false
  seconds.value = 0
  clearInterval(countIntervalId)
}

let relaunchAppLoading = false

const { mutate: doRelaunchApp } = initMutation({
  document: relaunchAppGQL,
})

const togglePause = () => {
  paused.value = !paused.value
  if (!paused.value) {
    refetch()
  }
}

const changeQuality = () => {
  openModal(ChangeScreenMirrorQualityModal)
}

const relaunchApp = () => {
  doRelaunchApp()
  relaunchAppLoading = true
}

const appSocketConnectionChangedHanlder = (connected: boolean) => {
  if (connected) {
    if (relaunchAppLoading) {
      relaunchAppLoading = false
      clearInterval(countIntervalId)
      start()
    }
  }
}

const takeScreenshot = () => {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }
  const d = new Date()
  const fileName = 'screenshot-' + [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()].join('') + '.png'
  download(canvas.toDataURL(), fileName)
}

function renderCanvas(blob: Blob) {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }
  if (paused.value && !showLatest.value) {
    return
  }
  showLatest.value = false
  const ctx = canvas.getContext('2d')
  const img = new Image()
  img.src = URL.createObjectURL(blob)
  img.onload = function () {
    if (ctx) {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
    }
  }
}

onActivated(() => {
  emitter.on('screen_mirroring', screenMirroringHandler)
  emitter.on('app_socket_connection_changed', appSocketConnectionChangedHanlder)
})

onDeactivated(() => {
  emitter.off('screen_mirroring', screenMirroringHandler)
  emitter.off('app_socket_connection_changed', appSocketConnectionChangedHanlder)
})

const {
  mutate: startService,
  loading: startServiceLoading,
  onDone: startServiceDone,
  onError: startServiceError,
} = initMutation({
  document: startScreenMirrorGQL,
})

const { loading: fetchImageLoading, refetch } = initQuery({
  handle: (data: { screenMirrorState: boolean }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (!data.screenMirrorState) {
        state.value = false
        showLatest.value = false
        start()
      } else {
        state.value = true
        showLatest.value = true
      }
    }
  },
  options: {
    fetchPolicy: 'no-cache',
  },
  document: screenMirrorStateGQL,
})

const requestFullscreen = () => {
  document.getElementsByClassName('screen-mirror')[0].requestFullscreen({ navigationUI: 'show' })
}

const start = () => {
  failed.value = false
  paused.value = false
  startService()
}

const exitFullscreen = () => {
  document.exitFullscreen()
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
  state.value = false
})
</script>
<style lang="scss" scoped>
.canvas {
  margin: 0 auto;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

:fullscreen {
  background-color: var(--md-sys-color-surface);
  padding: 0 16px;
  .content {
    height: auto;
  }
  .canvas {
    max-height: calc(100vh - 60px);
  }
  .btn-exit-fullscreen {
    display: block;
  }
  .dropdown-item.exit-fullscreen {
    display: flex;
  }
  .btn-enter-fullscreen,
  .dropdown-item.enter-fullscreen,
  .btn-stop {
    display: none;
  }
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

  i {
    width: 20px;
    height: 20px;
  }
}
</style>
