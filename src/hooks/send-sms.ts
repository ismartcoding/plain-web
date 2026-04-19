import { nextTick, onMounted, ref, computed, reactive } from 'vue'
import { popModal } from '@/components/modal'
import { initMutation, sendSmsGQL, sendMmsGQL } from '@/lib/api/mutation'
import tapPhone from '@/plugins/tapphone'
import { upload as uploadFile } from '@/lib/upload/upload'
import { shortUUID } from '@/lib/strutil'
import { getContactFullName } from '@/lib/contact/format'
import type { IUploadItem } from '@/stores/temp'
import type { IContact } from '@/lib/interfaces'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import { formatFileSize } from '@/lib/format'
import { useContactPicker } from '@/hooks/contact-picker'

export const MMS_WARN_SIZE = 300 * 1024

export function useSendSms(initialNumber: string, initialBody: string) {
  const { t } = useI18n()
  const { app } = storeToRefs(useTempStore())

  const number = ref(initialNumber)
  const body = ref(initialBody)
  const errors = reactive({ number: '', body: '' })
  const numberRef = ref<HTMLInputElement>()
  const pendingFiles = ref<File[]>([])
  const fileInputRef = ref<HTMLInputElement>()
  const mmsUploading = ref(false)

  const {
    showContactPicker, selectedContactName, filteredContacts, contactsLoading,
    toggleContactPicker, onNumberInput, onNumberFocus, selectContactNumber, clearSelectedContact,
    getContactFullName,
  } = useContactPicker(() => number.value || '')

  // File handling
  const totalPendingSize = computed(() => pendingFiles.value.reduce((s, f) => s + f.size, 0))
  const hasLargeNonImageFile = computed(() => pendingFiles.value.some((f) => !f.type.startsWith('image/') && f.size > MMS_WARN_SIZE))

  function openFilePicker() { fileInputRef.value?.click() }
  function onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) pendingFiles.value = [...pendingFiles.value, ...Array.from(input.files)]
    input.value = ''
  }
  function removePendingFile(index: number) { pendingFiles.value = pendingFiles.value.filter((_, i) => i !== index) }
  function filePreviewUrl(file: File): string { return URL.createObjectURL(file) }

  async function uploadAttachments(): Promise<string[]> {
    const paths: string[] = []
    const mmsDir = `${app.value.appDir}/mms_tmp`
    for (const file of pendingFiles.value) {
      const item: IUploadItem = { id: shortUUID(), dir: mmsDir, fileName: file.name, file, status: 'pending', uploadedSize: 0, error: '', isAppFile: false }
      const result = await uploadFile(item, false) as { fileName?: string; error?: string } | undefined
      if (result && result.fileName) paths.push(`${mmsDir}/${result.fileName}`)
      else throw new Error(t('upload_failed'))
    }
    return paths
  }

  // Mutations
  const { mutate, loading, onDone } = initMutation({ document: sendSmsGQL })
  const { mutate: mutateMms, loading: mmsLoading, onDone: onMmsDone } = initMutation({ document: sendMmsGQL })

  const cancel = () => popModal()

  async function submit() {
    const numberOk = !!number.value?.trim()
    const bodyOk = !!body.value?.trim()
    errors.number = numberOk ? '' : 'valid.required'
    errors.body = bodyOk ? '' : 'valid.required'

    if (pendingFiles.value.length > 0 && numberOk) {
      mmsUploading.value = true
      try {
        const attachmentPaths = await uploadAttachments()
        mutateMms({ number: number.value, body: body.value || '', attachmentPaths, threadId: '' })
      } catch (e: any) { toast(e.message || t('upload_failed'), 'error') } finally { mmsUploading.value = false }
    } else if (numberOk && bodyOk) {
      mutate({ number: number.value, body: body.value })
    }
  }

  onDone(() => { emitter.emit('sms_sent'); popModal() })
  onMmsDone(() => { tapPhone(t('confirm_mms_on_phone')); popModal() })

  onMounted(async () => {
    await nextTick()
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          if (document.activeElement && document.activeElement !== document.body) (document.activeElement as HTMLElement).blur()
          numberRef.value?.focus()
        } catch (error) { console.debug('Focus blocked:', error) }
      }, 100)
    })
  })

  return {
    number, body, errors, pendingFiles, fileInputRef, mmsUploading, numberRef,
    showContactPicker, selectedContactName, filteredContacts, contactsLoading,
    loading, mmsLoading, totalPendingSize, hasLargeNonImageFile,
    cancel, submit,
    onNumberInput: () => onNumberInput(number.value || ''),
    onNumberFocus: () => onNumberFocus(number.value || ''),
    selectContactNumber: (phone: string, contact: IContact) =>
      selectContactNumber(phone, contact, (n) => { number.value = n }),
    clearSelectedContact: () => clearSelectedContact(() => { number.value = '' }),
    openFilePicker, onFileSelected,
    removePendingFile, filePreviewUrl, getContactFullName, formatFileSize,
  }
}
