import { defineStore } from 'pinia'

// data will be stored to local storage
export type MainState = {
  fileShowHidden: boolean
  chatTexts: Record<string, string>
  quick: string
  quickContentWidth: number
  sidebarWidth: number
  sidebar2Width: number
  miniSidebar: boolean
  lastRoutes: Record<string, string>
  lightboxInfoVisible: boolean
  videosCardView: boolean
  imagesCardView: boolean
  pageUIMode: Record<string, 'view' | 'edit'>
  bucketFilterCollapsed: Record<string, boolean>
  appSortBy: string
  fileSortBy: string
  imageSortBy: string
  imagesGroupBy: string // '' | 'TAKEN_AT'
  imagesScrollPaging: boolean
  videosGroupBy: string // '' | 'TAKEN_AT'
  videosScrollPaging: boolean
  audiosScrollPaging: boolean
  pageSize: number
  videoSortBy: string
  audioSortBy: string
  conversationSortBy: string
  json: string // data in jsonViewer
  qrCode: string // data in qrCode Generator
  callNumber: string
  feedEntryFontSize: number // font size for feed entry content
  searchHistory: Record<string, string[]>
  notificationSound: boolean
}

export const useMainStore = defineStore('main', {
  state: () =>
    ({
      fileShowHidden: false,
      chatTexts: {},
      quick: '',
      quickContentWidth: 400,
      sidebarWidth: 240,
      sidebar2Width: 360,
      miniSidebar: false,
      noteExpand: true,
      lastRoutes: {},
      audios: [],
      audioPlaying: null,
      lightboxInfoVisible: false,
      videosCardView: false,
      imagesCardView: false,
      pageUIMode: {},
      bucketFilterCollapsed: {},
      appSortBy: 'NAME_ASC',
      fileSortBy: 'NAME_ASC',
      imageSortBy: 'DATE_DESC',
      imagesGroupBy: '',
      imagesScrollPaging: false,
      videosGroupBy: '',
      videosScrollPaging: false,
      audiosScrollPaging: false,
      pageSize: 50,
      videoSortBy: 'DATE_DESC',
      audioSortBy: 'DATE_DESC',
      conversationSortBy: 'DATE_DESC',
      json: '',
      qrCode: '',
      callNumber: '',
      feedEntryFontSize: 16, // default font size
      searchHistory: {},
      notificationSound: true,
    }) as MainState,
  actions: {
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
