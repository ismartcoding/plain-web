import type { ISource } from '@/components/lightbox/types'
import type { IFile } from '@/lib/file'
import { defineStore } from 'pinia'
import type sjcl from 'sjcl'

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
  sources: ISource[]
  visible: boolean
  index: number
}

// data will be lost when page refreshed, or the data use different way to store data
export type TempState = {
  app: any // store the appFragment result
  urlTokenKey: sjcl.BitArray | null
  uploads: IUploadItem[]
  selectedFiles: IFile[]
  audioPlaying: boolean
  lightbox: ILightBox
}

export const useTempStore = defineStore({
  id: 'temp',
  state: () =>
    ({
      app: null,
      urlTokenKey: null,
      uploads: [],
      selectedFiles: [],
      audioPlaying: false,
      lightbox: { sources: [], visible: false, index: -1 },
    }) as TempState,
})
