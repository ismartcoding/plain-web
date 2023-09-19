import { defineStore } from 'pinia'

// data will be stored to local storage
export type MainState = {
  fileShowHidden: boolean
  chatText: string
  quick: string
  pages: string[]
  lightboxInfoVisible: boolean
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
