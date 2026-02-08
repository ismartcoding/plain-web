import type { ApolloCache, DocumentNode } from '@apollo/client/core'
import gql from 'graphql-tag'
import { useMutation } from '@vue/apollo-composable'
import { chatItemFragment, feedEntryFragment, feedFragment, fileFragment, noteFragment, playlistAudioFragment, tagFragment } from './fragments'
import { logErrorMessages } from '@vue/apollo-util'
import emitter from '@/plugins/eventbus'

export class InitMutationParams {
  document!: DocumentNode
  options?: any = {}
}
export function initMutation(params: InitMutationParams, handleError = true) {
  const r = useMutation(params.document, {
    clientId: 'a',
    ...params.options,
  })

  if (handleError) {
    r.onError((error) => {
      if (error.networkError?.message === 'connection_timeout') {
        emitter.emit('toast', 'connection_timeout')
      } else {
        emitter.emit('toast', error.message)
      }
      logErrorMessages(error)
    })
  }

  return r
}

export async function runMutation<TVariables extends Record<string, any> | undefined>(
  mutate: (variables?: TVariables) => Promise<any>,
  onDone: (fn: (...args: any[]) => void) => { off: () => void },
  onError: (fn: (...args: any[]) => void) => { off: () => void },
  variables?: TVariables
): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    let doneSub: { off: () => void } | null = null
    let errorSub: { off: () => void } | null = null

    const cleanup = () => {
      doneSub?.off()
      errorSub?.off()
      doneSub = null
      errorSub = null
    }

    doneSub = onDone(() => {
      cleanup()
      resolve(true)
    })

    errorSub = onError(() => {
      cleanup()
      resolve(false)
    })

    mutate(variables).catch(() => {
      // Errors are handled via onError callbacks.
    })
  })
}

export function insertCache(cache: ApolloCache<any>, data: any, query: DocumentNode, variables?: any, reversed: boolean = false) {
  const q: any = cache.readQuery({ query, variables })
  const key = Object.keys(q)[0]
  const obj: Record<string, any> = {}
  if (key === 'files') {
    obj[key] = {
      ...q[key],
      items: reversed ? data.concat(q[key]['items']) : q[key]['items'].concat(data),
    }
  } else {
    obj[key] = reversed ? data.concat(q[key]) : q[key].concat(data)
  }
  cache.writeQuery({ query, variables, data: obj })
}

export const createChatItemGQL = gql`
  mutation createChatItem($content: String!) {
    createChatItem(content: $content) {
      ...ChatItemFragment
    }
  }
  ${chatItemFragment}
`

export const deleteChatItemGQL = gql`
  mutation deleteChatItem($id: ID!) {
    deleteChatItem(id: $id)
  }
`

export const createDirGQL = gql`
  mutation createDir($path: String!) {
    createDir(path: $path) {
      ...FileFragment
    }
  }
  ${fileFragment}
`

export const writeTextFileGQL = gql`
  mutation writeTextFile($path: String!, $content: String!, $overwrite: Boolean!) {
    writeTextFile(path: $path, content: $content, overwrite: $overwrite) {
      ...FileFragment
    }
  }
  ${fileFragment}
`

export const renameFileGQL = gql`
  mutation renameFile($path: String!, $name: String!) {
    renameFile(path: $path, name: $name)
  }
`

export const copyFileGQL = gql`
  mutation copyFile($src: String!, $dst: String!, $overwrite: Boolean!) {
    copyFile(src: $src, dst: $dst, overwrite: $overwrite)
  }
`

export const moveFileGQL = gql`
  mutation moveFile($src: String!, $dst: String!, $overwrite: Boolean!) {
    moveFile(src: $src, dst: $dst, overwrite: $overwrite)
  }
`

export const playAudioGQL = gql`
  mutation playAudio($path: String!) {
    playAudio(path: $path) {
      ...PlaylistAudioFragment
    }
  }
  ${playlistAudioFragment}
`

export const updateAudioPlayModeGQL = gql`
  mutation updateAudioPlayMode($mode: MediaPlayMode!) {
    updateAudioPlayMode(mode: $mode)
  }
`

export const deletePlaylistAudioGQL = gql`
  mutation deletePlaylistAudio($path: String!) {
    deletePlaylistAudio(path: $path)
  }
`

export const addPlaylistAudiosGQL = gql`
  mutation addPlaylistAudios($query: String!) {
    addPlaylistAudios(query: $query)
  }
`

export const clearAudioPlaylistGQL = gql`
  mutation clearAudioPlaylist {
    clearAudioPlaylist
  }
`

export const reorderPlaylistAudiosGQL = gql`
  mutation reorderPlaylistAudios($paths: [String!]!) {
    reorderPlaylistAudios(paths: $paths)
  }
`

export const deleteMediaItemsGQL = gql`
  mutation deleteMediaItems($type: DataType!, $query: String!) {
    deleteMediaItems(type: $type, query: $query) {
      type
      query
    }
  }
`

export const trashMediaItemsGQL = gql`
  mutation trashMediaItems($type: DataType!, $query: String!) {
    trashMediaItems(type: $type, query: $query) {
      type
      query
    }
  }
`

export const restoreMediaItemsGQL = gql`
  mutation restoreMediaItems($type: DataType!, $query: String!) {
    restoreMediaItems(type: $type, query: $query) {
      type
      query
    }
  }
`

export const removeFromTagsGQL = gql`
  mutation removeFromTags($type: DataType!, $tagIds: [ID!]!, $query: String!) {
    removeFromTags(type: $type, tagIds: $tagIds, query: $query)
  }
`

export const addToTagsGQL = gql`
  mutation addToTags($type: DataType!, $tagIds: [ID!]!, $query: String!) {
    addToTags(type: $type, tagIds: $tagIds, query: $query)
  }
`

export const updateTagRelationsGQL = gql`
  mutation updateTagRelations($type: DataType!, $item: TagRelationStub!, $addTagIds: [ID!]!, $removeTagIds: [ID!]!) {
    updateTagRelations(type: $type, item: $item, addTagIds: $addTagIds, removeTagIds: $removeTagIds)
  }
`

export const createTagGQL = gql`
  mutation createTag($type: DataType!, $name: String!) {
    createTag(type: $type, name: $name) {
      ...TagFragment
    }
  }
  ${tagFragment}
`

export const updateTagGQL = gql`
  mutation updateTag($id: ID!, $name: String!) {
    updateTag(id: $id, name: $name) {
      ...TagFragment
    }
  }
  ${tagFragment}
`

export const deleteTagGQL = gql`
  mutation deleteTag($id: ID!) {
    deleteTag(id: $id)
  }
`

export const addFavoriteFolderGQL = gql`
  mutation addFavoriteFolder($rootPath: String!, $fullPath: String!) {
    addFavoriteFolder(rootPath: $rootPath, fullPath: $fullPath) {
      rootPath
      fullPath
    }
  }
`

export const removeFavoriteFolderGQL = gql`
  mutation removeFavoriteFolder($fullPath: String!) {
    removeFavoriteFolder(fullPath: $fullPath) {
      rootPath
      fullPath
      alias
    }
  }
`

export const setFavoriteFolderAliasGQL = gql`
  mutation setFavoriteFolderAlias($fullPath: String!, $alias: String!) {
    setFavoriteFolderAlias(fullPath: $fullPath, alias: $alias) {
      rootPath
      fullPath
      alias
    }
  }
`

export const saveNoteGQL = gql`
  mutation saveNote($id: ID!, $input: NoteInput!) {
    saveNote(id: $id, input: $input) {
      ...NoteFragment
    }
  }
  ${noteFragment}
`

export const deleteNotesGQL = gql`
  mutation deleteNotes($query: String!) {
    deleteNotes(query: $query)
  }
`

export const trashNotesGQL = gql`
  mutation trashNotes($query: String!) {
    trashNotes(query: $query)
  }
`

export const restoreNotesGQL = gql`
  mutation restoreNotes($query: String!) {
    restoreNotes(query: $query)
  }
`

export const deleteFeedEntriesGQL = gql`
  mutation deleteFeedEntries($query: String!) {
    deleteFeedEntries(query: $query)
  }
`

export const deleteCallsGQL = gql`
  mutation deleteCalls($query: String!) {
    deleteCalls(query: $query)
  }
`

export const deleteContactsGQL = gql`
  mutation deleteContacts($query: String!) {
    deleteContacts(query: $query)
  }
`

export const createFeedGQL = gql`
  mutation createFeed($url: String!, $fetchContent: Boolean!) {
    createFeed(url: $url, fetchContent: $fetchContent) {
      ...FeedFragment
    }
  }
  ${feedFragment}
`

export const importFeedsGQL = gql`
  mutation importFeeds($content: String!) {
    importFeeds(content: $content)
  }
`

export const exportFeedsGQL = gql`
  mutation exportFeeds {
    exportFeeds
  }
`

export const exportNotesGQL = gql`
  mutation exportNotes($query: String!) {
    exportNotes(query: $query)
  }
`

export const relaunchAppGQL = gql`
  mutation relaunchApp {
    relaunchApp
  }
`

export const deleteFeedGQL = gql`
  mutation deleteFeed($id: ID!) {
    deleteFeed(id: $id)
  }
`

export const updateFeedGQL = gql`
  mutation updateFeed($id: ID!, $name: String!, $fetchContent: Boolean!) {
    updateFeed(id: $id, name: $name, fetchContent: $fetchContent) {
      ...FeedFragment
    }
  }
  ${feedFragment}
`

export const syncFeedsGQL = gql`
  mutation syncFeeds($id: ID) {
    syncFeeds(id: $id)
  }
`

export const syncFeedContentGQL = gql`
  mutation syncFeedContent($id: ID!) {
    syncFeedContent(id: $id) {
      ...FeedEntryFragment
      feed {
        ...FeedFragment
      }
    }
  }
  ${feedFragment}
  ${feedEntryFragment}
`

export const callGQL = gql`
  mutation call($number: String!) {
    call(number: $number)
  }
`

export const uninstallPackagesGQL = gql`
  mutation uninstallPackages($ids: [ID!]!) {
    uninstallPackages(ids: $ids)
  }
`

export const uninstallPackageGQL = gql`
  mutation uninstallPackages($id: ID!) {
    uninstallPackages(ids: [$id])
  }
`

export const installPackageGQL = gql`
  mutation installPackage($path: String!) {
    installPackage(path: $path) {
      packageName
      updatedAt
      isNew
    }
  }
`

export const startScreenMirrorGQL = gql`
  mutation startScreenMirror {
    startScreenMirror
  }
`

export const stopScreenMirrorGQL = gql`
  mutation stopScreenMirror {
    stopScreenMirror
  }
`

export const setTempValueGQL = gql`
  mutation setTempValue($key: String!, $value: String!) {
    setTempValue(key: $key, value: $value) {
      key
      value
    }
  }
`

export const cancelNotificationsGQL = gql`
  mutation cancelNotifications($ids: [ID!]!) {
    cancelNotifications(ids: $ids)
  }
`

export const updateScreenMirrorQualityGQL = gql`
  mutation updateScreenMirrorQuality($quality: Int!, $resolution: Int!) {
    updateScreenMirrorQuality(quality: $quality, resolution: $resolution)
  }
`

export const saveFeedEntriesToNotesGQL = gql`
  mutation saveFeedEntriesToNotes($query: String!) {
    saveFeedEntriesToNotes(query: $query)
  }
`
export const mergeChunksGQL = gql`
  mutation mergeChunks($fileId: String!, $totalChunks: Int!, $path: String!, $replace: Boolean!) {
    mergeChunks(fileId: $fileId, totalChunks: $totalChunks, path: $path, replace: $replace)
  }
`

export const startPomodoroGQL = gql`
  mutation startPomodoro($timeLeft: Int!) {
    startPomodoro(timeLeft: $timeLeft)
  }
`

export const stopPomodoroGQL = gql`
  mutation stopPomodoro {
    stopPomodoro
  }
`

export const pausePomodoroGQL = gql`
  mutation pausePomodoro {
    pausePomodoro
  }
`
