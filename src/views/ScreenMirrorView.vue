<template>
  <div class="page-container">
    <div class="main">
      <div class="v-toolbar">
        <breadcrumb :current="() => $t('screen_mirror')" />
        <template v-if="state">
          <button class="icon-button" v-if="!paused" @click="() => refetch()" v-tooltip="$t('refresh')">
            <md-ripple />
            <i-material-symbols:refresh-rounded />
          </button>
          <md-outlined-button @click="togglePause" class="btn-sm">{{ $t(paused ? 'resume' : 'pause') }}</md-outlined-button>
          <md-outlined-button :disabled="stopServiceLoading" @click="stopService" v-tooltip="$t('stop_mirror')" class="btn-sm">{{ $t('stop_mirror') }}</md-outlined-button>
          <button class="icon-button" @click="requestFullscreen" v-tooltip="$t('fullscreen')">
            <md-ripple />
            <i-material-symbols:fullscreen-rounded />
          </button>
        </template>
        <md-outlined-button v-else-if="!relaunchAppLoading" @click="relaunchApp">{{ $t('relaunch_app') }}</md-outlined-button>
      </div>
      <div ref="containerRef" class="panel-container">
        <div v-if="fetchImageLoading || startServiceLoading || relaunchAppLoading" class="loading">
          <md-circular-progress indeterminate />
        </div>
        <div v-if="seconds > 0 && !relaunchAppLoading" class="request-permission">
          <img src="@/assets/screen-mirror-permission.png" />
          <pre class="text">{{ $t('screen_mirror_request_permission', { seconds: seconds }) }}</pre>
        </div>
        <div v-if="failed && !state && !relaunchAppLoading" class="request-permission-failed">
          <MobileWarning />
          <p>{{ $t('screen_mirror_request_permission_failed') }}</p>
          <md-filled-button @click="start">{{ $t('try_again') }}</md-filled-button>
        </div>
        <canvas v-show="state" ref="canvasRef" class="canvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import emitter from '@/plugins/eventbus'
import toast from '@/components/toaster'
import { onMounted, onUnmounted, ref } from 'vue'
import MobileWarning from '@/assets/mobile-warning.svg'
import { initQuery, screenMirrorStateGQL } from '@/lib/api/query'
import { useI18n } from 'vue-i18n'
import { initMutation, relaunchAppGQL, startScreenMirrorGQL, stopScreenMirrorGQL } from '@/lib/api/mutation'
import type { ApolloError } from '@apollo/client/errors'

let countIntervalId: number
const { t } = useI18n()
const state = ref(false)
const seconds = ref(0)
const failed = ref(false)
const paused = ref(false)
const containerRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()

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
  appApi: true,
})

const togglePause = () => {
  paused.value = !paused.value
  if (!paused.value) {
    refetch()
  }
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

function renderCanvas(blob: Blob) {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }
  if (paused.value) {
    return
  }
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

onMounted(() => {
  emitter.on('screen_mirroring', screenMirroringHandler)
  emitter.on('app_socket_connection_changed', appSocketConnectionChangedHanlder)
})

onUnmounted(() => {
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
  appApi: true,
})

const { loading: fetchImageLoading, refetch } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (!data.screenMirrorState) {
        state.value = false
        start()
      } else {
        state.value = true
      }
    }
  },
  document: screenMirrorStateGQL,
  appApi: true,
})

const requestFullscreen = () => {
  containerRef.value?.requestFullscreen({ navigationUI: 'show' })
}
const start = () => {
  failed.value = false
  startService()
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
  appApi: true,
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
  max-height: calc(100vh - 150px);
  object-fit: contain;
}

.main {
  height: 100%;
}

.panel-container {
  position: relative;
  height: 100%;
  min-height: calc(100vh - 150px);
}

:fullscreen {
  .canvas {
    max-height: 100%;
  }
}

.request-permission {
  padding-bottom: 40px;
  text-align: center;

  img {
    width: 320px;
    margin: 0 auto 40px auto;
  }

  .text {
    text-align: center;
    font-size: 1.2rem;
    line-height: 2;
    margin-block-end: 16px;
  }
}

.request-permission-failed {
  padding-top: 40px;
  padding-bottom: 40px;
  text-align: center;
  font-size: 1.2rem;
  line-height: 2;

  *:is(svg) {
    width: 160px;
    display: block;
    fill: currentColor;
    margin: 0 auto 40px auto;
  }
}
</style>
