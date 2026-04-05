import { ref, onUnmounted } from 'vue'
import emitter from '@/plugins/eventbus'
import { enableImageSearchGQL, disableImageSearchGQL, cancelImageDownloadGQL, startImageIndexGQL, cancelImageIndexGQL, initMutation } from '@/lib/api/mutation'
import type { IImageSearchStatus } from '@/lib/interfaces'

export function useImageSearchActions() {
  const enableLoading = ref(false)
  const disableLoading = ref(false)
  const cancelDownloadLoading = ref(false)
  const startIndexLoading = ref(false)
  const cancelIndexLoading = ref(false)

  const { mutate: mutateEnable } = initMutation({ document: enableImageSearchGQL })
  const { mutate: mutateDisable } = initMutation({ document: disableImageSearchGQL })
  const { mutate: mutateCancelDownload } = initMutation({ document: cancelImageDownloadGQL })
  const { mutate: mutateStartIndex } = initMutation({ document: startImageIndexGQL })
  const { mutate: mutateCancelIndex } = initMutation({ document: cancelImageIndexGQL })

  function onStatusUpdated(data: IImageSearchStatus) {
    if (!data) return
    const s = data.status
    if (s && s !== 'UNAVAILABLE' && s !== 'ERROR') enableLoading.value = false
    if (s === 'UNAVAILABLE') { disableLoading.value = false; cancelDownloadLoading.value = false }
    if (data.isIndexing) startIndexLoading.value = false
    else cancelIndexLoading.value = false
  }

  emitter.on('image_search_updated', onStatusUpdated)
  onUnmounted(() => emitter.off('image_search_updated', onStatusUpdated))

  function enable() { mutateEnable({}); enableLoading.value = true }
  function disable() { mutateDisable({}); disableLoading.value = true }
  function cancelDownload() { mutateCancelDownload({}); cancelDownloadLoading.value = true }
  function startIndex(force = false) { mutateStartIndex({ force }); startIndexLoading.value = true }
  function cancelIndex() { mutateCancelIndex({}); cancelIndexLoading.value = true }

  return { enable, disable, cancelDownload, startIndex, cancelIndex, enableLoading, disableLoading, cancelDownloadLoading, startIndexLoading, cancelIndexLoading }
}
