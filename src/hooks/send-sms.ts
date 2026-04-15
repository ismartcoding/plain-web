import { nextTick, onMounted, onBeforeUnmount, ref, computed, reactive } from 'vue'
import { popModal } from '@/components/modal'
import { initMutation, sendSmsGQL, sendMmsGQL } from '@/lib/api/mutation'
import { initLazyQuery, contactsGQL } from '@/lib/api/query'
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

  // Contact picker
  const showContactPicker = ref(false)
  const allContacts = ref<IContact[]>([])
  const selectedContactName = ref('')
  const phoneFieldRef = ref<HTMLElement>()

  const filteredContacts = computed(() => {
    const contacts = allContacts.value.filter((c) => c.phoneNumbers.length > 0)
    const q = (number.value || '').trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) => getContactFullName(c).toLowerCase().includes(q) || c.phoneNumbers.some((p) => (p.normalizedNumber || p.value).toLowerCase().includes(q)),
    )
  })

  const { loading: contactsLoading, fetch: fetchContacts } = initLazyQuery({
    handle: (data: { contacts: IContact[] }, error: string) => { if (!error && data) allContacts.value = data.contacts },
    document: contactsGQL,
    variables: () => ({ offset: 0, limit: 5000, query: '' }),
  })

  function toggleContactPicker() {
    showContactPicker.value = !showContactPicker.value
    if (showContactPicker.value && allContacts.value.length === 0) fetchContacts()
  }

  function onNumberInput() {
    selectedContactName.value = ''
    if (allContacts.value.length > 0 && number.value?.trim()) showContactPicker.value = true
  }

  function onNumberFocus() {
    if (allContacts.value.length > 0 && number.value?.trim()) showContactPicker.value = true
  }

  function selectContactNumber(phone: string, contact: IContact) {
    number.value = phone
    selectedContactName.value = getContactFullName(contact)
    showContactPicker.value = false
  }

  function clearSelectedContact() { selectedContactName.value = ''; number.value = '' }

  function handleClickOutside(e: MouseEvent) {
    if (phoneFieldRef.value && !phoneFieldRef.value.contains(e.target as Node)) showContactPicker.value = false
  }

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
    document.addEventListener('click', handleClickOutside, true)
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

  onBeforeUnmount(() => { document.removeEventListener('click', handleClickOutside, true) })

  return {
    number, body, errors, pendingFiles, fileInputRef, mmsUploading, numberRef,
    showContactPicker, selectedContactName, phoneFieldRef, filteredContacts, contactsLoading,
    loading, mmsLoading, totalPendingSize, hasLargeNonImageFile,
    cancel, submit, toggleContactPicker, onNumberInput, onNumberFocus,
    selectContactNumber, clearSelectedContact, openFilePicker, onFileSelected,
    removePendingFile, filePreviewUrl, getContactFullName, formatFileSize,
  }
}
