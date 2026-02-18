import { promptModal } from '@/components/modal'
import DirectoryPickerModal from '@/components/DirectoryPickerModal.vue'

export async function pickUploadDir(options: {
  title?: string
  description?: string
  initialPath?: string
  modalId?: string
  storageKey?: string
}): Promise<string | undefined> {
  const storageKey = String(options.storageKey || '').trim()
  const saved = storageKey ? String(localStorage.getItem(storageKey) || '').trim() : ''

  const selected = await promptModal<string>(DirectoryPickerModal, {
    title: options.title,
    description: options.description,
    initialPath: saved || options.initialPath,
    modalId: options.modalId || 'directory-picker',
  })

  if (typeof selected !== 'string') return
  const v = selected.trim()
  if (!v) return

  if (storageKey) {
    localStorage.setItem(storageKey, v)
  }

  return v
}
