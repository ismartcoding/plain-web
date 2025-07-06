import { ref, type Ref } from 'vue'
import { type IUploadItem } from '@/stores/temp'
import { shortUUID } from '@/lib/strutil'
import { getFileDir } from './files'

function createUploadItem(file: File, dir: string): IUploadItem {
  return {
    id: shortUUID(),
    dir: dir,
    fileName: '',
    file,
    status: 'created',
    uploadedSize: 0,
    error: '',
    pausing: false,
  }
}

export const useFileUpload = (uploads: Ref<IUploadItem[]>) => {
  let _dir = ''
  const input = ref<HTMLInputElement>()
  return {
    input,
    upload(dir: string) {
      _dir = dir
      input.value!.value = ''
      input.value!.click()
    },
    uploadChanged(e: Event) {
      const files = (e.target as HTMLInputElement).files
      if (!files) {
        return
      }
      const items = []
      for (let i = 0; i < files.length; i++) {
        items.push(createUploadItem(files[i], _dir))
      }
      uploads.value = [...uploads.value, ...items]
    },
  }
}

export const useDragDropUpload = (uploads: Ref<IUploadItem[]>) => {
  const dropping = ref(false)

  return {
    dropping,
    fileDragEnter(e: DragEvent) {
      if (e.dataTransfer?.types.includes('Files')) {
        dropping.value = true
      }
    },
    fileDragLeave() {
      dropping.value = false
    },
    dropFiles(e: DragEvent, dir: string, isValid: (file: File) => boolean) {
      dropping.value = false
      const files = e.dataTransfer?.files
      if (!files) {
        return
      }
      const items = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!isValid(file)) {
          continue
        }
        items.push(createUploadItem(file, dir))
      }
      if (items.length > 0) {
        uploads.value = [...uploads.value, ...items]
      }
    },
  }
}

export const useChatFilesUpload = () => {
  return {
    getUploads(baseDir: string, files: File[]): IUploadItem[] {
      const items = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        items.push({
          id: shortUUID(),
          dir: baseDir,
          fileName: file.name,
          file,
          status: 'created',
          uploadedSize: 0,
          error: '',
          pausing: false,
        })
      }
      return items
    },
  }
}

export const pasteToUpload = (e: ClipboardEvent, dir: string, uploads: Ref<IUploadItem[]>, type: string = '') => {
  const items = e.clipboardData?.items
  if (!items) {
    return
  }

  const files: IUploadItem[] = []
  for (const item of items) {
    if (item.kind !== 'file') {
      continue
    }

    const file = item.getAsFile()
    if (file) {
      if (file.type && type && !file.type.startsWith(type)) {
        continue
      }
      files.push(createUploadItem(file, dir))
    }
  }

  if (files.length > 0) {
    uploads.value = [...uploads.value, ...files]
  }
}
