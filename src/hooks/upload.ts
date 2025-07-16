import { ref, type Ref } from 'vue'
import { type IUploadItem } from '@/stores/temp'
import { shortUUID } from '@/lib/strutil'

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

  const readDirectory = async (entry: FileSystemDirectoryEntry, basePath = ''): Promise<Array<{ file: File; relativePath: string }>> => {
    const files: Array<{ file: File; relativePath: string }> = []
    const reader = entry.createReader()
    
    const readEntries = (): Promise<FileSystemEntry[]> => {
      return new Promise((resolve) => {
        reader.readEntries(resolve)
      })
    }

    const entries = await readEntries()
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => {
          (entry as FileSystemFileEntry).file(resolve)
        })
        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name
        files.push({ file, relativePath })
      } else if (entry.isDirectory) {
        const subPath = basePath ? `${basePath}/${entry.name}` : entry.name
        const subFiles = await readDirectory(entry as FileSystemDirectoryEntry, subPath)
        files.push(...subFiles)
      }
    }
    return files
  }

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
    async dropFiles(e: DragEvent, dir: string, isValid: (file: File) => boolean) {
      dropping.value = false
      const items = e.dataTransfer?.items
      if (!items) {
        return
      }
      
      const allFileItems: Array<{ file: File; relativePath: string }> = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry()
          if (entry?.isFile) {
            const file = item.getAsFile()
            if (file) allFileItems.push({ file, relativePath: file.name })
          } else if (entry?.isDirectory) {
            const dirFiles = await readDirectory(entry as FileSystemDirectoryEntry, entry.name)
            allFileItems.push(...dirFiles)
          }
        }
      }

      const uploadItems = []
      for (const fileItem of allFileItems) {
        if (isValid(fileItem.file)) {
          const file = fileItem.file
          const pathParts = fileItem.relativePath.split('/')
          let targetDir = dir
          if (pathParts.length > 1) {
            const subPath = pathParts.slice(0, -1).join('/')
            targetDir = dir.endsWith('/') ? dir + subPath : dir + '/' + subPath
          }
          uploadItems.push(createUploadItem(file, targetDir))
        }
      }
      
      if (uploadItems.length > 0) {
        uploads.value = [...uploads.value, ...uploadItems]
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
