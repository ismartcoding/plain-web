import gql from 'graphql-tag'
import { useLazyQuery, useQuery } from '@vue/apollo-composable'
import type { DocumentParameter, OptionsParameter } from '@vue/apollo-composable/dist/useQuery'
import {
  chatItemFragment,
  messageFragment,
  contactFragment,
  callFragment,
  imageFragment,
  videoFragment,
  audioFragment,
  fileFragment,
  appFragment,
  tagFragment,
  noteFragment,
  feedFragment,
  feedEntryFragment,
  packageFragment,
  tagSubFragment,
  notificationFragment,
  deviceInfoFragment,
} from './fragments'
import type { ApolloQueryResult } from '@apollo/client'

export class InitQueryParams<TResult> {
  handle!: (data: TResult, error: string) => void
  document!: DocumentParameter<TResult, undefined>
  variables?: any = null
  options?: OptionsParameter<TResult, null> = {}
}

export function initQuery<TResult = any>(params: InitQueryParams<TResult>) {
  const { result, onResult, refetch, loading, variables } = useQuery(params.document, params.variables, () => ({
    clientId: 'a',
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
    clientId: 'a',
    ...(typeof params.options === 'function' ? params.options() : params.options),
  }))

  // if (result.value) {
  //   params.handle(result.value, '')
  // }

  let first = true

  onResult((r: ApolloQueryResult<any>) => {
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

  return {
    result,
    onResult,
    load,
    loading,
    variables,
    refetch,
    fetch: () => {
      if (first) {
        first = false
        load()
      } else {
        refetch()
      }
    },
  }
}

export const chatItemsGQL = gql`
  query ($id: String!) {
    chatItems(id: $id) {
      ...ChatItemFragment
    }
  }
  ${chatItemFragment}
`

export const fileInfoGQL = gql`
  query ($id: ID!, $path: String!) {
    fileInfo(id: $id, path: $path) {
      ... on FileInfo {
        path
        updatedAt
        size
        tags {
          ...TagSubFragment
        }
      }
      data {
        ... on ImageFileInfo {
          width
          height
          location {
            latitude
            longitude
          }
        }
        ... on VideoFileInfo {
          duration
          width
          height
          location {
            latitude
            longitude
          }
        }
        ... on AudioFileInfo {
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
    imageCount(query: "")
    audioCount(query: "")
    videoCount(query: "")
    packageCount(query: "")
    noteCount(query: "")
    feedEntryCount(query: "")
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
    items: audios(offset: $offset, limit: $limit, query: $query, sortBy: $sortBy) {
      ...AudioFragment
    }
    total: audioCount(query: $query)
  }
  ${audioFragment}
`

export const filesGQL = gql`
  query files($root: String!, $offset: Int!, $limit: Int!, $query: String!, $sortBy: FileSortBy!) {
    files(root: $root, offset: $offset, limit: $limit, query: $query, sortBy: $sortBy) {
      ...FileFragment
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
    items: feedEntries(offset: $offset, limit: $limit, query: $query) {
      id
      title
      url
      image
      author
      feedId
      rawId
      publishedAt
      createdAt
      updatedAt
      tags {
        ...TagSubFragment
      }
    }
    total: feedEntryCount(query: $query)
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

export const bucketsTagsGQL = gql`
  query bucketsTags($type: DataType!) {
    tags(type: $type) {
      ...TagFragment
    }
    mediaBuckets(type: $type) {
      id
      name
      itemCount
      topItems
    }
  }
  ${tagFragment}
`

export const feedEntryGQL = gql`
  query feedEntry($id: ID!) {
    feedEntry(id: $id) {
      ...FeedEntryFragment
      feed {
        ...FeedFragment
      }
    }
  }
  ${feedFragment}
  ${feedEntryFragment}
`

export const imageCountGQL = gql`
  query {
    total: imageCount(query: "")
    trash: imageCount(query: "trash:true")
  }
`

export const audioCountGQL = gql`
  query {
    total: audioCount(query: "")
    trash: audioCount(query: "trash:true")
  }
`

export const videoCountGQL = gql`
  query {
    total: videoCount(query: "")
    trash: videoCount(query: "trash:true")
  }
`

export const packageCountGQL = gql`
  query {
    total: packageCount(query: "")
    system: packageCount(query: "type:system")
  }
`

export const feedEntryCountGQL = gql`
  query {
    total: feedEntryCount(query: "")
    today: feedEntryCount(query: "today:true")
    feedsCount {
      id
      count
    }
  }
`

export const contactCountGQL = gql`
  query {
    total: contactCount(query: "")
  }
`

export const callCountGQL = gql`
  query {
    total: callCount(query: "")
    incoming: callCount(query: "type:1")
    outgoing: callCount(query: "type:2")
    missed: callCount(query: "type:3")
  }
`

export const smsCountGQL = gql`
  query {
    total: messageCount(query: "")
    inbox: messageCount(query: "type:1")
    sent: messageCount(query: "type:2")
    drafts: messageCount(query: "type:3")
  }
`

export const noteCountGQL = gql`
  query {
    total: noteCount(query: "")
    trash: noteCount(query: "trash:true")
  }
`

export const packagesGQL = gql`
  query packages($offset: Int!, $limit: Int!, $query: String!, $sortBy: FileSortBy!) {
    packages(offset: $offset, limit: $limit, query: $query, sortBy: $sortBy) {
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
      updatedAt
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

export const uploadedChunksGQL = gql`
  query uploadedChunks($fileId: String!) {
    uploadedChunks(fileId: $fileId)
  }
`

export const pomodoroSettingsGQL = gql`
  query {
    pomodoroSettings {
      workDuration
      shortBreakDuration
      longBreakDuration
      pomodorosBeforeLongBreak
      showNotification
      playSoundOnComplete
    }
  }
`

export const pomodoroTodayAndSettingsGQL = gql`
  query {
    pomodoroToday {
      date
      completedCount
      currentRound
      timeLeft
      totalTime
      isRunning
      isPause
      state
    }
    pomodoroSettings {
      workDuration
      shortBreakDuration
      longBreakDuration
      pomodorosBeforeLongBreak
      showNotification
      playSoundOnComplete
    }
  }
`
