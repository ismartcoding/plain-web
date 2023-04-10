import { defineStore } from 'pinia'

export interface IUploadItem {
  dir: string
  file: File
  uploadedSize: number
  status: string
  error: string
  xhr?: XMLHttpRequest
}

// data will be lost when page refreshed, or the data use different way to store data
export type TempState = {
  app: any // store the appFragment result
  uploads: IUploadItem[]
  dark: boolean
}

export const useTempStore = defineStore({
  id: 'temp',
  state: () =>
    ({
      app: null,
      uploads: [],
      dark: localStorage.getItem('dark') === 'true' || window.matchMedia('(prefers-color-scheme: dark)').matches,
    } as TempState),
})
