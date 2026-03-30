import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getUploadUrl } from '@/lib/upload/upload'
import { chachaEncrypt, bitArrayToUint8Array } from '@/lib/api/crypto'
import * as sjcl from 'sjcl'
import toast from '@/components/toaster'

const ACCEPTED = new Set([
  'mobileclip_s2_image.tflite',
  'mobileclip_s2_text.tflite',
  'tokenizer.json',
])

export function useAIModelUpload(onDone: () => void) {
  const { t } = useI18n()
  const uploading = ref(false)
  const uploadStatus = ref('')
  const uploadProgress = ref(0)

  function validateFiles(files: FileList): File[] | null {
    const valid: File[] = []
    for (let i = 0; i < files.length; i++) {
      if (ACCEPTED.has(files[i].name)) valid.push(files[i])
    }
    if (valid.length === 0) return null
    return valid
  }

  async function uploadModelFiles(files: FileList, modelDir: string) {
    const valid = validateFiles(files)
    if (!valid) {
      toast(t('ai.wrong_files'), 'error')
      return
    }

    uploading.value = true
    uploadProgress.value = 0
    const token = localStorage.getItem('auth_token') ?? ''
    const key = sjcl.codec.base64.toBits(token)
    const clientId = localStorage.getItem('client_id') ?? ''
    const totalBytes = valid.reduce((s, f) => s + f.size, 0)
    let completedBytes = 0

    try {
      for (const file of valid) {
        uploadStatus.value = t('ai.uploading', { name: file.name })
        await uploadSingleFile(file, modelDir, key, clientId, (loaded) => {
          const pct = Math.round(((completedBytes + loaded) / totalBytes) * 100)
          uploadProgress.value = Math.min(pct, 99)
        })
        completedBytes += file.size
        uploadProgress.value = Math.round((completedBytes / totalBytes) * 100)
      }
      uploadProgress.value = 100
      uploadStatus.value = t('ai.upload_done')
      onDone()
    } catch (e: any) {
      toast(t('ai.upload_failed', { error: e.message || 'Unknown error' }), 'error')
    } finally {
      uploading.value = false
    }
  }

  return { uploading, uploadStatus, uploadProgress, uploadModelFiles }
}

function uploadSingleFile(
  file: File, dir: string, key: sjcl.BitArray, clientId: string,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const info = JSON.stringify({ dir, replace: true, isAppFile: false, size: file.size })
    const encrypted = bitArrayToUint8Array(chachaEncrypt(key, info))
    const form = new FormData()
    form.append('info', new Blob([encrypted.buffer as ArrayBuffer]))
    form.append('file', file, file.name)

    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded)
    })
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 201) resolve()
        else reject(new Error(xhr.responseText || `HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.open('POST', getUploadUrl(), true)
    xhr.setRequestHeader('c-id', clientId)
    xhr.send(form)
  })
}
