import gql from 'graphql-tag'
import { useLazyQuery, useQuery } from '@vue/apollo-composable'
import type { DocumentParameter, OptionsParameter } from '@vue/apollo-composable/dist/useQuery'
import { chatItemFragment, messageFragment, contactFragment, callFragment, imageFragment, videoFragment, audioFragment, fileFragment, appFragment, tagFragment, noteFragment, feedFragment, feedEntryFragment, aiChatFragment, packageFragment, tagSubFragment, notificationFragment, deviceInfoFragment } from './fragments'

export class InitQueryParams<TResult> {
  handle!: (data: TResult, error: string) => void
  document!: DocumentParameter<TResult, undefined>
  variables?: any = null
  options?: OptionsParameter<TResult, null> = {}
  appApi?: boolean = false
}

export function initQuery<TResult = any>(params: InitQueryParams<TResult>) {
  const { result, onResult, refetch, loading, variables } = useQuery(params.document, params.variables, () => ({
    clientId: params.appApi ? 'a' : 'b',
    ...(typeof params.options === 'function' ? params.options() : params.options),
  }))

  if (result.value) {
    params.handle(result.value, '')
  }

  onResult((r) => {
    let error = ''
    if (r.error) {
      if (r.error?.networkError) {
        if (r.error?.networkError?.response?.status === 403) {
          error = 'web_access_disabled'
        } else {
          error = 'network_error'
        }
      } else {
        error = r.error?.message
      }
    }
    if (error || r.data) {
      params.handle(r.data, error)
    }
  })

  return { result, onResult, refetch, loading, variables }
}

export function initLazyQuery<TResult = any>(params: InitQueryParams<TResult>) {
  const { result, onResult, load, loading, variables, refetch } = useLazyQuery(params.document, params.variables, () => ({
    clientId: params.appApi ? 'a' : 'b',
    ...(typeof params.options === 'function' ? params.options() : params.options),
  }))

  if (result.value) {
    params.handle(result.value, '')
  }

  onResult((r) => {
    let error = ''
    if (r.error) {
      if (r.error?.networkError) {
        error = 'network_error'
      } else {
        error = r.error?.message
      }
    }
    if (error || r.data) {
      params.handle(r.data, error)
    }
  })

  return { result, onResult, load, loading, variables, refetch }
}

export const chatItemsGQL = gql`
  query {
    chatItems {
      ...ChatItemFragment
    }
  }
  ${chatItemFragment}
`

export const fileInfoGQL = gql`
  query ($id: ID!, $path: String!) {
    fileInfo(id: $id, path: $path) {
      ... on FileInfo {
        updatedAt
        size
      }
      data {
        ... on ImageFileInfo {
          tags {
            ...TagSubFragment
          }
          width
          height
          location {
            latitude
            longitude
          }
        }
        ... on VideoFileInfo {
          tags {
            ...TagSubFragment
          }
          duration
          width
          height
          location {
            latitude
            longitude
          }
        }
        ... on AudioFileInfo {
          tags {
            ...TagSubFragment
          }
          duration
          location {
            latitude
            longitude
          }
        }
      }
    }
  }
  ${tagSubFragment}
`

export const messagesGQL = gql`
  query messages($offset: Int!, $limit: Int!, $query: String!) {
    messages(offset: $offset, limit: $limit, query: $query) {
      ...MessageFragment
    }
    messageCount(query: $query)
  }
  ${messageFragment}
`

export const contactsGQL = gql`
  query contacts($offset: Int!, $limit: Int!, $query: String!) {
    contacts(offset: $offset, limit: $limit, query: $query) {
      ...ContactFragment
    }
    contactCount(query: $query)
  }
  ${contactFragment}
`

export const homeStatsGQL = gql`
  query {
    messageCount(query: "")
    contactCount(query: "")
    callCount(query: "")
    storageStats {
      internal {
        totalBytes
        freeBytes
      }
      sdcard {
        totalBytes
        freeBytes
      }
      usb {
        totalBytes
        freeBytes
      }
    }
  }
`

export const contactSourcesGQL = gql`
  query {
    contactSources {
      name
      type
    }
  }
`

export const callsGQL = gql`
  query calls($offset: Int!, $limit: Int!, $query: String!) {
    calls(offset: $offset, limit: $limit, query: $query) {
      ...CallFragment
    }
    callCount(query: $query)
  }
  ${callFragment}
`

export const imagesGQL = gql`
  query images($offset: Int!, $limit: Int!, $query: String!, $sortBy: FileSortBy!) {
    images(offset: $offset, limit: $limit, query: $query, sortBy: $sortBy) {
      ...ImageFragment
    }
    imageCount(query: $query)
  }
  ${imageFragment}
`

export const videosGQL = gql`
  query videos($offset: Int!, $limit: Int!, $query: String!, $sortBy: FileSortBy!) {
    videos(offset: $offset, limit: $limit, query: $query, sortBy: $sortBy) {
      ...VideoFragment
    }
    videoCount(query: $query)
  }
  ${videoFragment}
`

export const audiosGQL = gql`
  query audios($offset: Int!, $limit: Int!, $query: String!, $sortBy: FileSortBy!) {
    audios(offset: $offset, limit: $limit, query: $query, sortBy: $sortBy) {
      ...AudioFragment
    }
    audioCount(query: $query)
  }
  ${audioFragment}
`

export const filesGQL = gql`
  query files($dir: String!, $showHidden: Boolean!, $sortBy: FileSortBy!) {
    files(dir: $dir, showHidden: $showHidden, sortBy: $sortBy) {
      dir
      items {
        ...FileFragment
      }
    }
  }
  ${fileFragment}
`

export const recentFilesGQL = gql`
  query recentFiles {
    recentFiles {
      ...FileFragment
    }
  }
  ${fileFragment}
`

export const storageStatsGQL = gql`
  query {
    storageStats {
      internal {
        totalBytes
        freeBytes
      }
      sdcard {
        totalBytes
        freeBytes
      }
      usb {
        totalBytes
        freeBytes
      }
    }
  }
`

export const appGQL = gql`
  query {
    app {
      ...AppFragment
    }
  }
  ${appFragment}
`

export const tagsGQL = gql`
  query tags($type: DataType!) {
    tags(type: $type) {
      ...TagFragment
    }
  }
  ${tagFragment}
`

export const mediaBucketsGQL = gql`
  query mediaBuckets($type: DataType!) {
    mediaBuckets(type: $type) {
      id
      name
      itemCount
      topItems
    }
  }
`

export const notesGQL = gql`
  query notes($offset: Int!, $limit: Int!, $query: String!) {
    notes(offset: $offset, limit: $limit, query: $query) {
      id
      title
      deletedAt
      createdAt
      updatedAt
      tags {
        ...TagSubFragment
      }
    }
    noteCount(query: $query)
  }
  ${tagSubFragment}
`

export const noteGQL = gql`
  query note($id: ID!) {
    note(id: $id) {
      ...NoteFragment
    }
  }
  ${noteFragment}
`

export const feedsGQL = gql`
  query {
    feeds {
      ...FeedFragment
    }
  }
  ${feedFragment}
`

export const feedEntriesGQL = gql`
  query feedEntries($offset: Int!, $limit: Int!, $query: String!) {
    feedEntries(offset: $offset, limit: $limit, query: $query) {
      id
      title
      url
      image
      author
      feedId
      description
      rawId
      publishedAt
      createdAt
      updatedAt
      tags {
        ...TagSubFragment
      }
    }
    feedEntryCount(query: $query)
  }
  ${tagSubFragment}
`

export const feedsTagsGQL = gql`
  query feedsTags($type: DataType!) {
    tags(type: $type) {
      ...TagFragment
    }
    feeds {
      ...FeedFragment
    }
  }
  ${feedFragment}
  ${tagFragment}
`

export const feedEntryGQL = gql`
  query feedEntry($id: ID!) {
    feedEntry(id: $id) {
      ...FeedEntryFragment
    }
  }
  ${feedEntryFragment}
`

export const latestExchangeRatesGQL = gql`
  query latestExchangeRates($live: Boolean!) {
    latestExchangeRates(live: $live) {
      date
      rates {
        k
        v
      }
    }
  }
`

export const aichatsGQL = gql`
  query aiChats($offset: Int!, $limit: Int!, $query: String!) {
    aiChats(offset: $offset, limit: $limit, query: $query) {
      ...AIChatFragment
    }
    aiChatCount(query: $query)
  }
  ${aiChatFragment}
`

export const aichatDetailGQL = gql`
  query aiChats($id: ID!, $query: String!) {
    aiChat(id: $id) {
      ...AIChatFragment
    }
    aiChats(offset: 0, limit: 1000, query: $query) {
      ...AIChatFragment
    }
    aiChatCount(query: $query)
  }
  ${aiChatFragment}
`

export const aiChatConfigGQL = gql`
  query {
    aiChatConfig {
      chatGPTApiKey
    }
  }
`

export const packagesGQL = gql`
  query packages($offset: Int!, $limit: Int!, $query: String!) {
    packages(offset: $offset, limit: $limit, query: $query) {
      ...PackageFragment
    }
    packageCount(query: $query)
  }
  ${packageFragment}
`

export const packageStatusesGQL = gql`
  query packageStatuses($ids: [ID!]!) {
    packageStatuses(ids: $ids) {
      id
      exist
    }
  }
`

export const screenMirrorStateGQL = gql`
  query {
    screenMirrorState
    screenMirrorQuality {
      resolution
      quality
    }
  }
`

export const screenMirrorQualityGQL = gql`
  query {
    screenMirrorQuality {
      resolution
      quality
    }
  }
`

export const notificationsGQL = gql`
  query {
    notifications {
      ...NotificationFragment
    }
  }
  ${notificationFragment}
`

export const deviceInfoGQL = gql`
  query {
    deviceInfo {
      ...DeviceInfoFragment
    }
    battery {
      level
      voltage
      health
      plugged
      temperature
      status
      technology
      capacity
    }
  }
  ${deviceInfoFragment}
`
