import { nextTick } from 'vue'
import { formatFileSize } from '@/lib/format'
import { pauseUpload, resumeUpload, retryUpload, removeUpload } from '@/lib/upload/upload-queue'
import { useTempStore, type IUploadItem } from '@/stores/temp'

export function canPauseItem(item: IUploadItem) {
  return ['uploading', 'pending'].includes(item.status) && !item.pausing
}

export function canResumeItem(item: IUploadItem) {
  return item.status === 'paused' && !item.pausing
}

export function canRetryItem(item: IUploadItem) {
  return item.status === 'error'
}

export function isPausingItem(item: IUploadItem) {
  return item.pausing === true
}

export function showProgress(item: IUploadItem) {
  return ['uploading', 'pending', 'saving'].includes(item.status) && item.uploadedSize > 0
}

export function getProgressPercentage(item: IUploadItem) {
  if (item.file.size === 0) return 0
  return Math.round((item.uploadedSize / item.file.size) * 100)
}

export function formatUploadSpeed(item: IUploadItem): string {
  if (!item.uploadSpeed || item.uploadSpeed <= 0) return '0 B/s'
  return formatFileSize(item.uploadSpeed) + '/s'
}

function abortXhr(item: IUploadItem) {
  if (item.xhrs && item.xhrs.size > 0) {
    for (const xhr of item.xhrs) {
      try { xhr.abort() } catch { /* ignore */ }
    }
    item.xhrs.clear()
  }
  if (item.xhr) {
    try { item.xhr.abort() } catch { /* ignore */ }
  }
}

export async function pauseItem(item: IUploadItem) {
  item.pausing = true
  await nextTick()
  abortXhr(item)
  item.status = 'paused'
  pauseUpload(item.id)
  setTimeout(() => { item.pausing = false }, 1000)
}

export function resumeItem(item: IUploadItem) {
  const ok = resumeUpload(item.id)
  if (ok) item.status = 'uploading'
}

export function retryItem(item: IUploadItem) {
  const ok = retryUpload(item.id)
  if (!ok) return
  item.status = 'uploading'
  item.error = ''
  item.uploadedSize = 0
  item.uploadSpeed = 0
  item.lastUploadedSize = 0
  item.lastUpdateTime = undefined
}

export function removeItem(item: IUploadItem) {
  removeUpload(item.id)
  abortXhr(item)
  item.status = 'canceled'
}

export function removeItemFromStore(item: IUploadItem) {
  const tempStore = useTempStore()
  const index = tempStore.uploads.indexOf(item)
  if (index > -1) tempStore.uploads.splice(index, 1)
}
