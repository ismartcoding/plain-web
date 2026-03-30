import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { imageSearchStatusGQL, initQuery } from '@/lib/api/query'
import { enableImageSearchGQL, disableImageSearchGQL, startImageIndexGQL, cancelImageIndexGQL, initMutation } from '@/lib/api/mutation'
import toast from '@/components/toaster'
import type { IImageSearchStatus } from '@/lib/interfaces'

export function useImageSearch() {
  const { t } = useI18n()
  const status = ref<IImageSearchStatus | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const { refetch } = initQuery({
    handle: (data: { imageSearchStatus: IImageSearchStatus }, error: string) => {
      if (error) toast(t(error), 'error')
      else if (data) status.value = { ...data.imageSearchStatus }
    },
    document: imageSearchStatusGQL,
    variables: null,
  })

  const needsPolling = computed(() => {
    const s = status.value?.status
    return s === 'DOWNLOADING' || s === 'LOADING' || status.value?.isIndexing
  })

  function startPolling() {
    if (!pollTimer) pollTimer = setInterval(() => refetch(), 2000)
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  watch(needsPolling, (p) => { if (p) startPolling(); else stopPolling() })
  onUnmounted(() => stopPolling())

  const enableLoading = ref(false)
  const startIndexLoading = ref(false)
  const cancelIndexLoading = ref(false)
  const disableLoading = ref(false)

  const { mutate: mutateEnable } = initMutation({ document: enableImageSearchGQL })
  const { mutate: mutateDisable, onDone: onDisableDone } = initMutation({ document: disableImageSearchGQL })
  onDisableDone(() => { disableLoading.value = false; toast(t('ai.disabled')); refetch() })
  const { mutate: mutateStartIndex } = initMutation({ document: startImageIndexGQL })
  const { mutate: mutateCancelIndex } = initMutation({ document: cancelImageIndexGQL })

  watch(() => status.value?.status, (s) => {
    if (s && s !== 'UNAVAILABLE' && s !== 'ERROR') enableLoading.value = false
  })
  watch(() => status.value?.isIndexing, (isIndexing) => {
    if (isIndexing) startIndexLoading.value = false
    else cancelIndexLoading.value = false
  })

  function enable() { mutateEnable({}); enableLoading.value = true; startPolling() }
  function disable() { mutateDisable({}); disableLoading.value = true }
  function startIndex(force = false) { mutateStartIndex({ force }); startIndexLoading.value = true; startPolling() }
  function cancelIndex() { mutateCancelIndex({}); cancelIndexLoading.value = true; setTimeout(() => refetch(), 1000) }

  const indexProgress = computed(() => {
    if (!status.value || status.value.totalImages === 0) return 0
    return Math.round((status.value.indexedImages / status.value.totalImages) * 100)
  })

  return { status, enable, disable, startIndex, cancelIndex, indexProgress, refetch, enableLoading, startIndexLoading, cancelIndexLoading, disableLoading }
}

