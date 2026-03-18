import { computed, ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { initMutation, sendSmsGQL, sendMmsGQL, callGQL } from '@/lib/api/mutation'
import { upload as uploadFile } from '@/lib/upload/upload'
import { shortUUID } from '@/lib/strutil'
import tapPhone from '@/plugins/tapphone'
import type { IUploadItem } from '@/stores/temp'

const MMS_WARN_SIZE = 300 * 1024

export function useMessageSend(
  appDir: () => string,
  threadId: () => string,
  getAddress: () => string,
  callbacks: {
    onSmsSent: () => void
    onMmsSent: (id: string, body: string, address: string, attachments: { path: string; contentType: string; name: string }[]) => void
  },
) {
  const { t } = useI18n()
  const messageBody = ref('')
  const pendingFiles = ref<File[]>([])
  const mmsUploading = ref(false)
  const fileInputRef = ref<HTMLInputElement>()

  const totalPendingSize = computed(() => pendingFiles.value.reduce((s, f) => s + f.size, 0))
  const hasLargeNonImageFile = computed(() =>
    pendingFiles.value.some((f) => !f.type.startsWith('image/') && f.size > MMS_WARN_SIZE),
  )

  const { mutate: mutateCall } = initMutation({ document: callGQL })
  const { mutate: mutateSendSms, loading: sendLoading, onDone: onSendDone } = initMutation({ document: sendSmsGQL })
  const { mutate: mutateSendMms, onDone: onSendMmsDone } = initMutation({ document: sendMmsGQL })

  onSendDone(() => callbacks.onSmsSent())

  onSendMmsDone((result: any) => {
    const pendingId: string = result?.data?.sendMms ?? ('pending_mms_' + Date.now())
    const pendingAttachments = pendingFiles.value.map((file) => ({
      path: URL.createObjectURL(file),
      contentType: file.type || 'application/octet-stream',
      name: file.name,
    }))
    const body = messageBody.value.trim()
    callbacks.onMmsSent(pendingId, body, getAddress(), pendingAttachments)
    messageBody.value = ''
    pendingFiles.value = []
    tapPhone(t('confirm_mms_on_phone'))
  })

  function callContact() {
    const address = getAddress()
    if (address) mutateCall({ number: address })
  }

  function openFilePicker() {
    fileInputRef.value?.click()
  }

  function onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) {
      pendingFiles.value = [...pendingFiles.value, ...Array.from(input.files)]
    }
    input.value = ''
  }

  function removePendingFile(index: number) {
    pendingFiles.value = pendingFiles.value.filter((_, i) => i !== index)
  }

  async function uploadAttachments(): Promise<string[]> {
    const paths: string[] = []
    const mmsDir = `${appDir()}/mms_tmp`
    for (const file of pendingFiles.value) {
      const item: IUploadItem = {
        id: shortUUID(),
        dir: mmsDir,
        fileName: file.name,
        file,
        status: 'pending',
        uploadedSize: 0,
        error: '',
        isAppFile: false,
      }
      const result = (await uploadFile(item, false)) as { fileName?: string; error?: string } | undefined
      if (result && result.fileName) {
        paths.push(`${mmsDir}/${result.fileName}`)
      } else {
        throw new Error(t('upload_failed'))
      }
    }
    return paths
  }

  async function sendMessage() {
    const body = messageBody.value.trim()
    const address = getAddress()
    if ((!body && pendingFiles.value.length === 0) || !address) return

    if (pendingFiles.value.length > 0) {
      mmsUploading.value = true
      try {
        const attachmentPaths = await uploadAttachments()
        mutateSendMms({ number: address, body: body || '', attachmentPaths, threadId: threadId() })
      } catch (e: any) {
        toast(e.message || t('upload_failed'), 'error')
      } finally {
        mmsUploading.value = false
      }
    } else {
      if (!body) return
      mutateSendSms({ number: address, body })
      messageBody.value = ''
    }
  }

  return {
    messageBody,
    pendingFiles,
    mmsUploading,
    sendLoading,
    fileInputRef,
    totalPendingSize,
    hasLargeNonImageFile,
    MMS_WARN_SIZE,
    callContact,
    openFilePicker,
    onFileSelected,
    removePendingFile,
    sendMessage,
  }
}
