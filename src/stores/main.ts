import type { IPage } from '@/lib/interfaces'
import { defineStore } from 'pinia'
import type { Router } from 'vue-router/dist/vue-router'

// data will be stored to local storage
export type MainState = {
  fileShowHidden: boolean
  chatText: string
  quick: string
  quickContentWidth: number
  pages: IPage[]
  lightboxInfoVisible: boolean
  videoViewType: string
  imageViewType: string
  fileSortBy: string
  imageSortBy: string
  videoSortBy: string
  audioSortBy: string
  json: string // data in jsonViewer
  qrCode: string // data in qrCode Generator
  callNumber: string
}

export const useMainStore = defineStore({
  id: 'main',
  state: () =>
    ({
      fileShowHidden: false,
      chatText: '',
      quick: 'chat',
      quickContentWidth: 400,
      noteExpand: true,
      pages: [],
      audios: [],
      audioPlaying: null,
      lightboxInfoVisible: false,
      videoViewType: 'grid',
      imageViewType: 'grid',
      fileSortBy: 'NAME_ASC',
      imageSortBy: 'DATE_DESC',
      videoSortBy: 'DATE_DESC',
      audioSortBy: 'DATE_DESC',
      json: '',
      qrCode: '',
      callNumber: '',
    }) as MainState,
  actions: {
    getCurrentPage(path: string): IPage {
      return this.pages.find((it: IPage) => it.path === path) || { path }
    },
    replaceRoute(from: string, to: string) {
      const index = this.pages.findIndex((it: IPage) => it.path === from)
      if (index !== -1) {
        this.pages.splice(index, 1, { path: to, sidebar: this.pages[index].sidebar })
      }
    },
    updatePageSidebar(path: string, sidebar: boolean) {
      const page = this.pages.find((it: IPage) => it.path === path)
      if (page) {
        page.sidebar = sidebar
      }
    },
  },
})
