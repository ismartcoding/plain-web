import type { IFile } from './file'

export interface ITag {
  id: string
  name: string
  count: number
}

export interface IBucket {
  id: string
  name: string
  itemCount: number
}

export interface IMessage {
  id: string
  body: string
  address: string
  serviceCenter: string
  date: string
  type: number
  tags: ITag[]
}

export interface INote {
  id: string
  title: string
  content: string
  tags: ITag[]
  createdAt: string
  updatedAt: string
  deletedAt: string
}

export interface IFeedEntry {
  id: string
  title: string
  url: string
  image: string
  description: string
  content: string
  author: string
  feedId: string
  rawId: string
  tags: ITag[]
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface IMedia {
  id: string
  title: string
  path: string
  size: number
  bucketId: string
  tags: ITag[]
}

export interface IAudio extends IMedia {
  artist: string
  duration: number
}

export type IImage = IMedia

export interface IVideo extends IMedia {
  duration: number
}

export interface IPlaylistAudio {
  title: string
  artist: string
  path: string
  fileId: string
  duration: number
  size: number
}

export interface IFilter {
  tags: ITag[]
  text: string
  bucketId?: string
}

export interface IFeedEntryFilter extends IFilter {
  feeds: IFeed[]
}

export interface ISelectable {
  checked: boolean
}

export interface IDropdownItem {
  text: string
  click: () => void
}

export interface ITagRelationStub {
  key: string
  title: string
  size: number
}

export interface IChatItem {
  id: string
  isMe: boolean
  createdAt: string
  content: string
  _content: any
  __typename: string
  data: any
}

export interface IMediaItem extends IMedia, ISelectable {}
export interface IAudioItem extends IAudio, IMediaItem {}
export interface IImageItem extends IImage, IMediaItem {
  fileId: string
}
export interface IVideoItem extends IVideo, IMediaItem {
  fileId: string
}

export interface INoteItem extends INote, ISelectable {}

export interface IMessageItem extends IMessage, ISelectable {}

export interface IFeedEntryItem extends IFeedEntry, ISelectable {}

export interface IFeed {
  id: string
  name: string
  url: string
  fetchContent: boolean
}

export interface INotification {
  id: string
  onlyOnce: boolean
  isClearable: boolean
  appId: string
  appName: string
  time: string
  silent: boolean
  title: string
  body: string
  icon: string
  actions: string[]
}

export interface IAIChat {
  id: string
  parentId: string
  isMe: boolean
  content: string
  md: string
  type: number
  tags: ITag[]
  createdAt: string
  updatedAt: string
}

export interface IAIChatItem extends IAIChat, ISelectable {}

export interface IApp {
  id: string
  name: string
  type: string
  version: string
  path: string
  size: number
  icon: string
  installedAt: string
  updatedAt: string
}

export interface IAppItem extends IApp, ISelectable {
  isUninstalling: boolean
}

export interface IStorageStatsItem {
  totalBytes: number
  freeBytes: number
}

export interface IMediaItemDeletedEvent {
  item: IMediaItem
  type: string
}

export interface IMediaItemsDeletedEvent {
  type: string
}

export interface IFileDeletedEvent {
  item: IFile
}

export interface IItemTagsUpdatedEvent {
  item: ITagRelationStub
  type: string
}

export interface IItemsTagsUpdatedEvent {
  type: string
}

export interface IScreenMirrorQuality {
  resolution: number
  quality: number
}

export interface IScreenMirrorQualityOption {
  id: string
  data?: IScreenMirrorQuality
}
