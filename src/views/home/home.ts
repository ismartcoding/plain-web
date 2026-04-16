import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/stores/main'
import { callGQL, setClipGQL, initMutation } from '@/lib/api/mutation'
import { homeStatsGQL, initQuery } from '@/lib/api/query'
import toast from '@/components/toaster'
import type { IHomeStats, IStorageMount } from '@/lib/interfaces'

export function useHomeData() {
  const { t } = useI18n()
  const mainStore = useMainStore()
  const { callNumber } = storeToRefs(mainStore)
  const { counter } = storeToRefs(useTempStore())
  const mounts = ref<IStorageMount[]>([])

  initQuery({
    handle: (data: IHomeStats, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else if (data) {
        mounts.value = data.mounts ?? []
        counter.value.messages = data.smsCount
        counter.value.contacts = data.contactCount
        counter.value.calls = data.callCount
        counter.value.videos = data.videoCount
        counter.value.images = data.imageCount
        counter.value.audios = data.audioCount
        counter.value.packages = data.packageCount
        counter.value.notes = data.noteCount
        counter.value.docs = data.docCount
        counter.value.feedEntries = data.feedEntryCount
        const vols = (data.mounts ?? []).filter((m) => (m.totalBytes ?? 0) > 0)
        counter.value.total = vols.reduce((sum, it) => sum + (it.totalBytes ?? 0), 0)
        counter.value.free = vols.reduce((sum, it) => sum + (it.freeBytes ?? 0), 0)
      }
    },
    document: homeStatsGQL,
    variables: null,
  })

  return { mounts }
}

export function usePhoneAction() {
  const mainStore = useMainStore()
  const { callNumber } = storeToRefs(mainStore)
  const callNumberError = ref(false)

  const { mutate: mutateCall, loading: callLoading } = initMutation({ document: callGQL })

  function pastePhoneNumber() {
    navigator.clipboard.readText().then((text) => { callNumber.value = text })
  }

  function callPhone() {
    if (!callNumber.value) { callNumberError.value = true; return }
    mutateCall({ number: callNumber.value })
  }

  watch(callNumber, () => { callNumberError.value = false })

  return { callNumber, callNumberError, callLoading, pastePhoneNumber, callPhone }
}

export function useClipboardAction() {
  const clipText = ref('')
  const clipTextError = ref(false)

  const { mutate: mutateSetClip, loading: setClipLoading } = initMutation({ document: setClipGQL })

  function pasteClipboardText() {
    navigator.clipboard.readText().then((text) => { clipText.value = text })
  }

  function sendClipboard() {
    if (!clipText.value) { clipTextError.value = true; return }
    mutateSetClip({ text: clipText.value })
  }

  watch(clipText, () => { clipTextError.value = false })

  return { clipText, clipTextError, setClipLoading, pasteClipboardText, sendClipboard }
}
