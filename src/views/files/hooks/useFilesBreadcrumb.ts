import { computed, type Ref } from 'vue'
import { formatFileSize } from '@/lib/format'
import { getFileName } from '@/lib/api/file'
import type { IFileFilter, IBreadcrumbItem, IStorageMount, IApp } from '@/lib/interfaces'

export function useFilesBreadcrumb(
  filter: IFileFilter,
  rootDir: Ref<string>,
  app: Ref<IApp>,
  mounts: Ref<IStorageMount[]>,
  t: (key: string, args?: any) => string,
) {
  function getPageTitle() {
    if (filter.type === 'SDCARD') return t('sdcard')
    if (filter.type === 'APP') return t('app_data')
    if (filter.type === 'USB_STORAGE') {
      const usbIndex = app.value.usbDiskPaths.indexOf(filter.rootPath)
      return `${t('usb_storage')} ${usbIndex !== -1 ? usbIndex + 1 : 1}`
    }
    return t('internal_storage')
  }

  function getPageStats() {
    if (filter.type === 'APP') return t('app_data')
    const v = mounts.value.find((m: IStorageMount) => m.mountPoint === filter.rootPath)
    if (!v) return ''
    return t('storage_free_total', {
      free: formatFileSize(v.freeBytes ?? 0),
      total: formatFileSize(v.totalBytes ?? 0),
    })
  }

  const breadcrumbPaths = computed(() => {
    const paths: IBreadcrumbItem[] = []
    let p = filter.parent
    while (p) {
      if (p === rootDir.value) break
      paths.unshift({ path: p, name: getFileName(p) })
      p = p.substring(0, p.lastIndexOf('/'))
    }
    paths.unshift({ path: rootDir.value, name: getPageTitle() })
    return paths
  })

  return { breadcrumbPaths, getPageStats }
}
