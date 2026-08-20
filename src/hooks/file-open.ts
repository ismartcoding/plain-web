import { type Ref } from 'vue'
import { canOpenInBrowser, canView, isTextFile } from '@/lib/file'

export interface UseFileOpenOptions<T extends { name: string }> {
  items: Ref<T[]>
  openTextFile?: (item: T) => void
  openBrowserFile: (item: T) => void
  viewMedia: (items: T[], f: T) => void
  download: (item: T) => void
}

export function useFileOpen<T extends { name: string }>(opts: UseFileOpenOptions<T>) {
  const { items, openTextFile, openBrowserFile, viewMedia, download } = opts

  function openFile(item: T) {
    if (isTextFile(item.name) && openTextFile) {
      openTextFile(item)
    } else if (canOpenInBrowser(item.name)) {
      openBrowserFile(item)
    } else if (canView(item.name)) {
      viewMedia(items.value, item)
    } else {
      download(item)
    }
  }

  return { openFile }
}
