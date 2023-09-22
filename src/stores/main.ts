import { defineStore } from 'pinia'

// data will be stored to local storage
export type MainState = {
  fileShowHidden: boolean
  chatText: string
  quick: string
  pages: string[]
  lightboxInfoVisible: boolean
  videoViewType: string
  imageViewType: string
  fileSortBy: string
  json: string // data in jsonViewer
  qrCode: string // data in qrCode Generator
}

export const useMainStore = defineStore({
  id: 'main',
  state: () =>
    ({
      fileShowHidden: false,
      chatText: '',
      quick: 'chat',
      noteExpand: true,
      pages: [],
      audios: [],
      audioPlaying: null,
      lightboxInfoVisible: false,
      videoViewType: 'grid',
      imageViewType: 'grid',
      fileSortBy: 'NAME_ASC',
      json: '',
      qrCode: '',
    }) as MainState,
  actions: {
    replaceRoute(from: string, to: string) {
      const index = this.pages.indexOf(from)
      if (index !== -1) {
        this.pages.splice(index, 1, to)
      }
    },
  },
})
