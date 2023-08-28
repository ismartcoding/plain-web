import type { ISource } from '@/components/lightbox/types'
import type { IFile } from '@/lib/file'
import { defineStore } from 'pinia'

export interface IUploadItem {
  dir: string
  fileName: string
  file: File
  uploadedSize: number
  status: string
  error: string
  xhr?: XMLHttpRequest
}

export interface ILightBox {
  sources: ISource[],
  visible: boolean
  index: number
}

// data will be lost when page refreshed, or the data use different way to store data
export type TempState = {
  app: any // store the appFragment result
  uploads: IUploadItem[]
  selectedFiles: IFile[]
  lightbox: ILightBox
  dark: boolean
}

export const useTempStore = defineStore({
  id: 'temp',
  state: () =>
  ({
    app: null,
    uploads: [],
    selectedFiles: [],
    lightbox: { sources: [], visible: false, index: -1 },
    dark: localStorage.getItem('dark') === 'true' || window.matchMedia('(prefers-color-scheme: dark)').matches,
  } as TempState),
})
