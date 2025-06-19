import type { IPage } from '@/lib/interfaces'
import { defineStore } from 'pinia'

// data will be stored to local storage
export type MainState = {
  fileShowHidden: boolean
  chatText: string
  quick: string
  quickContentWidth: number
  sidebarWidth: number
  sidebar2Width: number
  miniSidebar: boolean
  pages: IPage[]
  lightboxInfoVisible: boolean
  videosCardView: boolean
  imagesCardView: boolean
  appSortBy: string
  fileSortBy: string
  imageSortBy: string
  videoSortBy: string
  audioSortBy: string
  json: string // data in jsonViewer
  qrCode: string // data in qrCode Generator
  callNumber: string
  feedEntryFontSize: number // font size for feed entry content
}

export const useMainStore = defineStore('main', {
  state: () =>
    ({
      fileShowHidden: false,
      chatText: '',
      quick: 'chat',
      quickContentWidth: 400,
      sidebarWidth: 240,
      sidebar2Width: 360,
      miniSidebar: false,
      noteExpand: true,
      pages: [],
      audios: [],
      audioPlaying: null,
      lightboxInfoVisible: false,
      videosCardView: false,
      imagesCardView: false,
      appSortBy: 'NAME_ASC',
      fileSortBy: 'NAME_ASC',
      imageSortBy: 'DATE_DESC',
      videoSortBy: 'DATE_DESC',
      audioSortBy: 'DATE_DESC',
      json: '',
      qrCode: '',
      callNumber: '',
      feedEntryFontSize: 16, // default font size
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
    increaseFeedEntryFontSize() {
      if (this.feedEntryFontSize < 32) {
        this.feedEntryFontSize += 2
      }
    },
    decreaseFeedEntryFontSize() {
      if (this.feedEntryFontSize > 10) {
        this.feedEntryFontSize -= 2
      }
    },
    resetFeedEntryFontSize() {
      this.feedEntryFontSize = 16
    },
  },
})
