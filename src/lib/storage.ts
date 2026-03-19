import type { IStorageMount } from '@/lib/interfaces'
import { formatFileSize } from '@/lib/format'
import type { ComposerTranslation } from 'vue-i18n'

export function driveRank(m: IStorageMount): number {
  if (m.driveType === 'INTERNAL_STORAGE') return 0
  if (m.driveType === 'SDCARD') return 1
  if (m.driveType === 'USB_STORAGE') return 2
  if (m.driveType === 'APP') return 3
  return 9
}

export function sortMounts(mounts: IStorageMount[]): IStorageMount[] {
  return [...mounts].sort((a, b) => {
    const da = driveRank(a)
    const db = driveRank(b)
    if (da !== db) return da - db
    return (a.mountPoint || '').localeCompare(b.mountPoint || '')
  })
}

export function buildUsbIndexMap(mounts: IStorageMount[]): Map<string, number> {
  const usbPoints = mounts
    .filter((m) => m.driveType === 'USB_STORAGE')
    .map((m) => m.mountPoint)
    .filter(Boolean)
  return new Map(usbPoints.map((p, i) => [p, i + 1]))
}

export function mountTitle(m: IStorageMount, usbIndexMap: Map<string, number>, t: ComposerTranslation): string {
  if (m.driveType === 'INTERNAL_STORAGE') return t('internal_storage')
  if (m.driveType === 'APP') return t('app_data')
  if (m.driveType === 'SDCARD') return t('sdcard')
  if (m.driveType === 'USB_STORAGE') {
    const idx = usbIndexMap.get(m.mountPoint) ?? 1
    return `${t('usb_storage')} ${idx}`
  }
  return m.name || m.mountPoint
}

export function storageUsedPercent(freeBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0
  const usedBytes = Math.max(0, totalBytes - freeBytes)
  const pct = (usedBytes / totalBytes) * 100
  return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
}

export function storageCountText(freeBytes: number, totalBytes: number, t: ComposerTranslation): string {
  if (totalBytes <= 0) return ''
  return t('storage_free_total', {
    free: formatFileSize(freeBytes),
    total: formatFileSize(totalBytes),
  })
}
