export interface ITag {
  id: string
  name: string
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

export interface IAudio {
  id: string
  title: string
  artist: string
  path: string
  duration: number
  size: number
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

export interface IImage {
  id: string
  title: string
  path: string
  size: number
  tags: ITag[]
}

export interface IVideo {
  id: string
  title: string
  path: string
  duration: number
  size: number
  tags: ITag[]
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
  data: any
}

export interface IAudioItem extends IAudio, ISelectable {}

export interface IImageItem extends IImage, ISelectable {
  fileId: string
}

export interface IVideoItem extends IVideo, ISelectable {
  fileId: string
}

export interface INoteItem extends INote, ISelectable {}

export interface IMessageItem extends IMessage, ISelectable {}

export interface IFeedEntryItem extends IFeedEntry, ISelectable {}

export interface IFeed {
  id: string
  name: string
  url: string
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
  installedAt: string
  updatedAt: string
}

export interface IAppItem extends IApp, ISelectable {
  isUninstalling: boolean
}
