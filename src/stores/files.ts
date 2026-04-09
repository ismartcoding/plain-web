import type { IFile } from '@/lib/file'
import { defineStore } from 'pinia'

export type FilesState = {
  selectedFiles: IFile[]
  isCut: boolean
}

export const useFilesStore = defineStore('files', {
  state: () =>
    ({
      selectedFiles: [],
      isCut: false,
    }) as FilesState,
})
