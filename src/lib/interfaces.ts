import type { IFile } from './file'

export interface IData {
  id: string
}

export interface ITag extends IData {
  id: string
  name: string
  count: number
}

export interface IType extends IData {
  id: string
  name: string
}

export interface IPage {
  path: string // full path
  sidebar?: boolean
}

export interface IBucket extends IData {
  id: string
  name: string
  itemCount: number
  topItems: string[]
}

export interface IMessage extends IData {
  id: string
  body: string
  address: string
  serviceCenter: string
  date: string
  type: number
  threadId: string
  subscriptionId: number
  isMms?: boolean
  attachments?: IMessageAttachment[]
  tags: ITag[]
}

export interface IMessageAttachment {
  path: string
  contentType: string
  name: string
}

export interface IMessageConversation extends IData {
  id: string
  address: string
  snippet: string
  date: string
  messageCount: number
  read: boolean
}

export interface IContactContentItem {
  label: string
  value: string
  type: number
}

export interface IContactPhoneNumber extends IContactContentItem {
  normalizedNumber: string
}

export interface IContactSource {
  name: string
  type: number
}

export interface IPackageStatus {
  id: string
  exist: boolean
  updatedAt: string
}

export interface IContact extends IData {
  id: string
  suffix: string
  prefix: string
  firstName: string
  middleName: string
  lastName: string
  updatedAt: string
  notes: string
  source: string
  thumbnailId: string
  starred: boolean
  phoneNumbers: IContactPhoneNumber[]
  addresses: IContactContentItem[]
  emails: IContactContentItem[]
  websites: IContactContentItem[]
  events: IContactContentItem[]
  ims: IContactContentItem[]
  tags: ITag[]
}

export interface ICallGeo {
  isp: string
  city: string
  province: string
}

export interface ICall extends IData {
  id: string
  name: string
  number: string
  duration: number
  accountId: string
  startedAt: string
  photoId: string
  type: number
  geo?: ICallGeo
  tags: ITag[]
}

export interface INote extends IData {
  id: string
  title: string
  content: string
  tags: ITag[]
  createdAt: string
  updatedAt: string
  deletedAt: string
}

export interface IFeedEntry extends IData {
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

export interface IFeedEntryDetail extends IFeedEntry {
  feed?: IFeed
}

export interface IMedia extends IData {
  id: string
  title: string
  path: string
  size: number
  bucketId: string
  tags: ITag[]
  createdAt: string
  updatedAt: string
}

export interface IAudio extends IMedia {
  artist: string
  albumFileId: string
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
  tagIds: string[]
  text?: string
  bucketId?: string
  feedId?: string
  today?: boolean
  type?: string
  trash?: boolean
}

export interface IFileFilter {
  showHidden: boolean
  type: string
  rootPath: string
  text: string
  parent: string
  fileSize?: string
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

export interface IChatItem extends IData {
  id: string
  fromId: string
  toId: string
  createdAt: string
  content: string
  _content: any
  __typename: string
  data: any
}

export interface IPeer {
  id: string
  name: string
  ip: string
  status: string
  port: number
  deviceType: string
  createdAt: string
  updatedAt: string
}

export interface IFeedCount {
  id: string
  count: number
}

export interface IImageItem extends IImage {
  fileId: string
}
export interface IVideoItem extends IVideo {
  fileId: string
}

export interface IFeed extends IData {
  id: string
  name: string
  url: string
  fetchContent: boolean
}

export interface INotification extends IData {
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

export interface IPackage extends IData {
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

export interface IPackageItem extends IPackage {
  isUninstalling: boolean
}

// deleted, trashed, restored
export interface IMediaItemsActionedEvent {
  type: string
  action: string
  query: string
  id?: string
}
// deleted, trashed, restored
export interface INotesActionedEvent {
  action: string
  id?: string
}

export interface IFileDeletedEvent {
  item: IFile
}

export interface IFileRenamedEvent {
  oldPath: string
  newPath: string
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

export interface IStorageMount {
  id: string
  name: string
  path: string
  mountPoint: string
  fsType: string
  totalBytes: number
  usedBytes: number
  freeBytes: number
  remote: boolean
  alias: string
  driveType: string
  diskID: string
}

export interface IHomeStats {
  callCount: number
  contactCount: number
  smsCount: number
  noteCount: number
  mediaCount: number
  feedEntryCount: number
  videoCount: number
  audioCount: number
  imageCount: number
  packageCount: number
  mounts: IStorageMount[]
}

export interface IFavoriteFolder {
  rootPath: string
  fullPath: string
  alias?: string | null
}

export interface IApp {
  usbConnected: boolean
  urlToken: string
  httpPort: number
  httpsPort: number
  appDir: string
  deviceName: string
  battery: number
  appVersion: string
  osVersion: number
  channel: string
  permissions: string[]
  audios: IPlaylistAudio[]
  audioCurrent: string
  audioMode: string
  sdcardPath: string
  usbDiskPaths: string[]
  internalStoragePath: string
  downloadsDir: string
  developerMode: boolean
  favoriteFolders: IFavoriteFolder[]
}

export interface IBreadcrumbItem {
  path: string
  name: string
}
