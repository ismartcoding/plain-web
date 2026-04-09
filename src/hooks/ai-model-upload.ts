import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getUploadUrl } from '@/lib/upload/upload'
import { chachaEncrypt, bitArrayToUint8Array } from '@/lib/api/crypto'
import { tokenToKey } from '@/lib/api/file'
import toast from '@/components/toaster'

const ACCEPTED = new Set(['mobileclip_s2_image.tflite', 'mobileclip_s2_text.tflite', 'tokenizer.json'])

// Module-level state: persists across modal close/reopen
const uploading = ref(false)
const uploadStatus = ref('')
const uploadProgress = ref(0)
const uploadDone = ref(false)
let currentXhr: XMLHttpRequest | null = null

export function useAIModelUpload() {
  const { t } = useI18n()

  async function startUpload(files: FileList, modelDir: string) {
    const valid = validateFiles(files)
    if (!valid) {
      toast(t('ai.wrong_files'), 'error')
      return
    }
    uploadDone.value = false
    uploading.value = true
    uploadProgress.value = 0
    const token = localStorage.getItem('auth_token') ?? ''
    const key = tokenToKey(token)
    const clientId = localStorage.getItem('client_id') ?? ''
    const totalBytes = valid.reduce((s, f) => s + f.size, 0)
    let completedBytes = 0
    try {
      for (const file of valid) {
        uploadStatus.value = t('ai.uploading', { name: file.name })
        await uploadSingleFile(file, modelDir, key, clientId, (loaded) => {
          uploadProgress.value = Math.min(Math.round(((completedBytes + loaded) / totalBytes) * 100), 99)
        })
        completedBytes += file.size
        uploadProgress.value = Math.round((completedBytes / totalBytes) * 100)
      }
      uploadProgress.value = 100
      uploadStatus.value = t('ai.upload_done')
      uploadDone.value = true
    } catch (e: any) {
      if (e.message !== 'Upload cancelled') {
        toast(t('ai.upload_failed', { error: e.message || 'Unknown error' }), 'error')
      }
    } finally {
      uploading.value = false
      currentXhr = null
    }
  }

  function cancelUpload() {
    currentXhr?.abort()
    currentXhr = null
    uploading.value = false
    uploadStatus.value = ''
    uploadProgress.value = 0
  }

  return { uploading, uploadStatus, uploadProgress, uploadDone, startUpload, cancelUpload }
}

function validateFiles(files: FileList): File[] | null {
  const valid: File[] = []
  for (let i = 0; i < files.length; i++) {
    if (ACCEPTED.has(files[i].name)) valid.push(files[i])
  }
  return valid.length === 0 ? null : valid
}

function uploadSingleFile(
  file: File, dir: string, key: Uint8Array, clientId: string,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const info = JSON.stringify({ dir, replace: true, isAppFile: false, size: file.size })
    const encrypted = bitArrayToUint8Array(chachaEncrypt(key, info))
    const form = new FormData()
    form.append('info', new Blob([encrypted.buffer as ArrayBuffer]))
    form.append('file', file, file.name)
    const xhr = new XMLHttpRequest()
    currentXhr = xhr
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded)
    })
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        currentXhr = null
        if (xhr.status === 201) resolve()
        else reject(new Error(xhr.responseText || `HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => { currentXhr = null; reject(new Error('Network error')) }
    xhr.ontimeout = () => { currentXhr = null; reject(new Error('Upload timed out')) }
    xhr.onabort = () => { currentXhr = null; reject(new Error('Upload cancelled')) }
    xhr.open('POST', getUploadUrl(), true)
    xhr.setRequestHeader('c-id', clientId)
    xhr.send(form)
  })
}
