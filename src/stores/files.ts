import type { IFile } from '@/lib/file'
import { defineStore } from 'pinia'
import type sjcl from 'sjcl'

export type FilesState = {
  selectedFiles: IFile[]
  isCut: boolean
}

export const useFilesStore = defineStore({
  id: 'files',
  state: () =>
    ({
      selectedFiles: [],
      isCut: false,
    }) as FilesState,
})
