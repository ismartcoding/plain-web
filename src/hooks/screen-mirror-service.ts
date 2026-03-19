import { ref, computed, type Ref } from 'vue'
import toast from '@/components/toaster'
import tapPhone from '@/plugins/tapphone'
import { initLazyQuery, initQuery, screenMirrorControlEnabledGQL, screenMirrorStateGQL } from '@/lib/api/query'
import { useI18n } from 'vue-i18n'
import { initMutation, relaunchAppGQL, startScreenMirrorGQL, stopScreenMirrorGQL, updateScreenMirrorQualityGQL, requestScreenMirrorAudioGQL } from '@/lib/api/mutation'
import type { ApolloError } from '@apollo/client/errors'
import emitter from '@/plugins/eventbus'
import { openModal } from '@/components/modal'
import AccessibilityGuideModal from '@/components/AccessibilityGuideModal.vue'

export function useScreenMirrorService(
  mirroring: Ref<boolean>,
  failed: Ref<boolean>,
  recording: Ref<boolean>,
  toggleRecording: () => void,
  startWebRTC: () => void,
  cleanupWebRTC: () => void,
) {
  const { t } = useI18n()
  let countIntervalId: number
  const seconds = ref(0)
  const qualityMenuVisible = ref(false)
  const qualityMode = ref('AUTO')
  const audioRequesting = ref(false)
  const controlEnabled = ref(false)
  const accessibilityEnabled = ref(false)

  const modeLabels: Record<string, string> = {
    AUTO: 'mirror_auto',
    HD: 'mirror_hd',
    SMOOTH: 'mirror_smooth',
  }
  const modeLabel = computed(() => t(modeLabels[qualityMode.value] || 'mirror_auto'))

  const clearCountInterval = () => clearInterval(countIntervalId)

  // --- Mutations ---
  const { mutate: relaunchApp, loading: relaunchAppLoading } = initMutation({ document: relaunchAppGQL })

  const { mutate: startService, loading: startServiceLoading, onDone: startServiceDone, onError: startServiceError } = initMutation({ document: startScreenMirrorGQL })

  const { mutate: stopService, loading: stopServiceLoading, onDone: stopServiceDone, onError: stopServiceError } = initMutation({ document: stopScreenMirrorGQL })

  let pendingMode: string | null = null
  const { mutate: updateQuality, loading: updateQualityLoading, onDone: updateQualityDone } = initMutation({ document: updateScreenMirrorQualityGQL })

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

  // --- Audio permission ---
  const { mutate: requestMirrorAudio, onDone: requestMirrorAudioDone, onError: requestMirrorAudioError } = initMutation({ document: requestScreenMirrorAudioGQL })

  const requestAudioPermission = () => {
    if (audioRequesting.value) return
    audioRequesting.value = true
    tapPhone(t('confirm_mirror_audio_permission_on_phone'))
    requestMirrorAudio()
  }

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

  // --- State query ---
  const { loading: fetchStateLoading } = initQuery({
    handle: (data: { screenMirrorState: boolean; screenMirrorControlEnabled?: boolean; screenMirrorQuality?: { mode: string } }, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        if (data?.screenMirrorQuality?.mode) qualityMode.value = data.screenMirrorQuality.mode
        accessibilityEnabled.value = data?.screenMirrorControlEnabled === true
        if (!data.screenMirrorState) {
          mirroring.value = false
          start()
        } else {
          startWebRTC()
        }
      }
    },
    options: { fetchPolicy: 'no-cache' },
    document: screenMirrorStateGQL,
  })

  const { fetch: fetchScreenMirrorControlEnabled } = initLazyQuery({
    handle: (data: { screenMirrorControlEnabled: boolean }) => {
      if (data) {
        accessibilityEnabled.value = data?.screenMirrorControlEnabled === true
        if (accessibilityEnabled.value) controlEnabled.value = true
      }
    },
    document: screenMirrorControlEnabledGQL,
    variables: () => ({}),
  })

  // --- Start/Stop ---
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

  stopServiceError((error: ApolloError) => {
    toast(t(error.message))
  })

  stopServiceDone(() => {
    failed.value = true
    mirroring.value = false
    controlEnabled.value = false
    if (recording.value) toggleRecording()
    cleanupWebRTC()
  })

  // --- Control toggle ---
  const toggleControl = () => {
    if (controlEnabled.value) {
      controlEnabled.value = false
      return
    }
    if (!accessibilityEnabled.value) {
      openModal(AccessibilityGuideModal, {
        onConfirm: () => fetchScreenMirrorControlEnabled(),
      })
      return
    }
    controlEnabled.value = true
  }

  // --- Event handlers ---
  const showLoading = computed(() => fetchStateLoading.value || startServiceLoading.value || relaunchAppLoading.value || stopServiceLoading.value)

  const screenMirroringHandler = async () => {
    mirroring.value = true
    failed.value = false
    seconds.value = 0
    clearCountInterval()
    startWebRTC()
  }

  const appSocketConnectionChangedHandler = (connected: boolean) => {
    if (connected && relaunchAppLoading.value) {
      clearCountInterval()
      start()
    }
  }

  const screenMirrorAudioGrantedHandler = () => {
    window.location.reload()
  }

  return {
    seconds,
    qualityMenuVisible,
    qualityMode,
    audioRequesting,
    controlEnabled,
    modeLabel,
    clearCountInterval,
    relaunchApp,
    relaunchAppLoading,
    stopService,
    stopServiceLoading,
    updateQualityLoading,
    setQualityMode,
    requestAudioPermission,
    start,
    startServiceLoading,
    showLoading,
    toggleControl,
    screenMirroringHandler,
    appSocketConnectionChangedHandler,
    screenMirrorAudioGrantedHandler,
  }
}
