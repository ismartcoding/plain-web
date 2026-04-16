import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, onActivated, onDeactivated, ref, watch } from 'vue'
import { useScreenMirrorControl, type ScreenMirrorControlAction } from './screen-mirror-control'
import { useScreenMirrorMedia } from './screen-mirror-media'
import { useScreenMirrorService } from './screen-mirror-service'
import { useScreenMirrorWebRTC } from './screen-mirror-webrtc'
import { useScreenRecording } from './screen-recording'

export function useScreenMirrorView() {
  const { app } = storeToRefs(useTempStore())
  const isActive = ref(false)
  const videoRef = ref<HTMLVideoElement>()
  const controlOverlayRef = ref<HTMLDivElement>()

  // --- Composables (linear, no circular deps) ---
  const { recording, recordingTime, toggleRecording } = useScreenRecording(videoRef)
  const media = useScreenMirrorMedia(videoRef)
  const service = useScreenMirrorService()
  const webrtc = useScreenMirrorWebRTC(videoRef, service.onStreamReady, service.onDisconnected)

  // Wire WebRTC connect/cleanup into the service
  service.setWebRTC(webrtc.connect, webrtc.cleanup)

  const control = useScreenMirrorControl(videoRef, service.controlEnabled)

  // --- Derived state ---
  const showLoading = computed(() => service.showLoading.value || service.state.value === 'connecting')
  const mirroring = computed(() => service.state.value === 'streaming')
  const failed = computed(() => service.state.value === 'failed')
  const idle = computed(() => service.state.value === 'idle')
  const qualityMode = computed<'AUTO' | 'HD' | 'SMOOTH'>(() => service.qualityMode.value as 'AUTO' | 'HD' | 'SMOOTH')

  // --- Ref setters ---
  const setVideoRef = (el: Element | ComponentPublicInstance | null) => {
    videoRef.value = el instanceof HTMLVideoElement ? el : undefined
  }
  const setControlOverlayRef = (el: Element | ComponentPublicInstance | null) => {
    controlOverlayRef.value = el instanceof HTMLDivElement ? el : undefined
  }

  // --- Navigation actions ---
  const sendNavAction = (action: Extract<ScreenMirrorControlAction, 'BACK' | 'HOME' | 'RECENTS' | 'LOCK_SCREEN'>) => {
    control.sendControl({ action })
  }

  // --- Stop (also stop recording if active) ---
  const stopService = () => {
    if (recording.value) toggleRecording()
    service.stop()
  }

  // --- Watchers ---
  watch(controlOverlayRef, (el) => {
    control.removeListeners()
    control.attachOverlay(el)
    if (el) control.setupListeners()
  })

  watch(videoRef, (video) => {
    if (video && webrtc.pendingStream.value) {
      video.srcObject = webrtc.pendingStream.value
      video.play().catch(() => {})
      webrtc.pendingStream.value = null
    }
  })

  // Retry play when video becomes visible (state transitions to streaming)
  watch(mirroring, (active) => {
    if (active) nextTick(() => webrtc.retryPlay())
  })

  // --- Lifecycle ---
  onActivated(() => {
    isActive.value = true
    emitter.on('screen_mirroring', service.onScreenMirroring)
    emitter.on('webrtc_signaling', webrtc.handleSignaling)
    emitter.on('app_socket_connection_changed', service.onSocketReconnect)
    emitter.on('screen_mirror_audio_granted', service.onAudioGranted)
    document.addEventListener('fullscreenchange', media.onFullscreenChange)
    service.fetchState()
  })

  onDeactivated(() => {
    isActive.value = false
    emitter.off('screen_mirroring', service.onScreenMirroring)
    emitter.off('webrtc_signaling', webrtc.handleSignaling)
    emitter.off('app_socket_connection_changed', service.onSocketReconnect)
    emitter.off('screen_mirror_audio_granted', service.onAudioGranted)
    document.removeEventListener('fullscreenchange', media.onFullscreenChange)
    webrtc.cleanup()
    service.deactivate()
  })

  return {
    app, isActive, mirroring, failed, idle, showLoading,
    setVideoRef, setControlOverlayRef,
    recording, recordingTime, toggleRecording,
    paused: media.paused, muted: media.muted, isFullscreen: media.isFullscreen,
    togglePlay: media.togglePlay, toggleMute: media.toggleMute,
    toggleFullscreen: media.toggleFullscreen, takeScreenshot: media.takeScreenshot,
    seconds: service.seconds, qualityMenuVisible: ref(false), qualityMode,
    audioRequesting: service.audioRequesting, controlEnabled: service.controlEnabled,
    modeLabel: service.modeLabel,
    relaunchApp: service.relaunchApp, relaunchAppLoading: service.relaunchLoading,
    stopService, stopServiceLoading: service.stopLoading,
    setQualityMode: service.setQualityMode,
    requestAudioPermission: service.requestAudioPermission,
    start: service.start, toggleControl: service.toggleControl, sendNavAction,
  }
}
