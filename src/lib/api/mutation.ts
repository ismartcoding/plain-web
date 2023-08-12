import type { ApolloCache, DocumentNode } from '@apollo/client/core'
import gql from 'graphql-tag'
import { useMutation } from '@vue/apollo-composable'
import {
  chatItemFragment,
  feedEntryFragment,
  feedFragment,
  fileFragment,
  noteFragment,
  playlistAudioFragment,
  tagFragment,
} from './fragments'
import { logErrorMessages } from '@vue/apollo-util'
import emitter from '@/plugins/eventbus'

export class InitMutationParams {
  document!: DocumentNode
  options?: any = {}
  appApi?: boolean = false
}
export function initMutation(params: InitMutationParams, handleError = true) {
  const r = useMutation(params.document, {
    clientId: params.appApi ? 'a' : 'b',
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

export function updateCache(cache: ApolloCache<any>, data: any, query: DocumentNode, variables?: any) {
  const q: any = cache.readQuery({ query, variables })
  const key = Object.keys(q)[0]
  const obj: Record<string, any> = {}
  if (key === 'files') {
    obj[key] = {
      ...q[key],
      items: q[key]['items'].concat(data),
    }
  } else {
    obj[key] = q[key].concat(data)
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
  mutation addPlaylistAudios($paths: [String!]!) {
    addPlaylistAudios(paths: $paths)
  }
`

export const clearAudioPlaylistGQL = gql`
  mutation clearAudioPlaylist {
    clearAudioPlaylist
  }
`

export const deleteMediaItemsGQL = gql`
  mutation deleteMediaItems($tagType: TagType!, $ids: [ID!]!) {
    deleteMediaItems(tagType: $tagType, ids: $ids)
  }
`

export const deleteMediaItemGQL = gql`
  mutation deleteMediaItems($tagType: TagType!, $id: ID!) {
    deleteMediaItems(tagType: $tagType, ids: [$id])
  }
`

export const removeFromTagsGQL = gql`
  mutation removeFromTags($tagIds: [ID!]!, $keys: [ID!]!) {
    removeFromTags(tagIds: $tagIds, keys: $keys)
  }
`

export const addToTagsGQL = gql`
  mutation addToTags($tagType: TagType!, $tagIds: [ID!]!, $items: [TagRelationStub!]!) {
    addToTags(tagType: $tagType, tagIds: $tagIds, items: $items)
  }
`

export const updateTagRelationsGQL = gql`
  mutation updateTagRelations($tagType: TagType!, $item: TagRelationStub!, $addTagIds: [ID!]!, $removeTagIds: [ID!]!) {
    updateTagRelations(tagType: $tagType, item: $item, addTagIds: $addTagIds, removeTagIds: $removeTagIds)
  }
`

export const createTagGQL = gql`
  mutation createTag($type: TagType!, $name: String!) {
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

export const saveNoteGQL = gql`
  mutation saveNote($id: ID!, $input: NoteInput!) {
    saveNote(id: $id, input: $input) {
      ...NoteFragment
    }
  }
  ${noteFragment}
`

export const deleteNotesGQL = gql`
  mutation deleteNotes($ids: [ID!]!) {
    deleteNotes(ids: $ids)
  }
`

export const trashNotesGQL = gql`
  mutation trashNotes($ids: [ID!]!) {
    trashNotes(ids: $ids)
  }
`

export const untrashNotesGQL = gql`
  mutation untrashNotes($ids: [ID!]!) {
    untrashNotes(ids: $ids)
  }
`

export const deleteFeedEntriesGQL = gql`
  mutation deleteFeedEntries($ids: [ID!]!) {
    deleteFeedEntries(ids: $ids)
  }
`

export const deleteCallsGQL = gql`
  mutation deleteCalls($ids: [ID!]!) {
    deleteCalls(ids: $ids)
  }
`

export const deleteContactsGQL = gql`
  mutation deleteContacts($ids: [ID!]!) {
    deleteContacts(ids: $ids)
  }
`

export const createFeedGQL = gql`
  mutation createFeed($url: String!) {
    createFeed(url: $url) {
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

export const deleteFeedGQL = gql`
  mutation deleteFeed($id: ID!) {
    deleteFeed(id: $id)
  }
`

export const updateFeedGQL = gql`
  mutation updateFeed($id: ID!, $name: String!) {
    updateFeed(id: $id, name: $name) {
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
    }
  }
  ${feedEntryFragment}
`

export const callGQL = gql`
  mutation call($number: String!) {
    call(number: $number)
  }
`

export const createAIChatGQL = gql`
  mutation createAIChat($id: ID!, $message: String!, $isMe: Boolean!) {
    createAIChat(id: $id, message: $message, isMe: $isMe) {
      id
      parentId
      isMe
      content
      type
      createdAt
      updatedAt
    }
  }
`

export const deleteAIChatItemsGQL = gql`
  mutation deleteAIChats($ids: [ID!]!) {
    deleteAIChats(ids: $ids)
  }
`

export const deleteAIChatsGQL = gql`
  mutation deleteAIChats($ids: [ID!]!) {
    deleteAIChats(ids: $ids)
    deleteAIChatsByParentIds(ids: $ids)
  }
`

export const updateAIChatConfigGQL = gql`
  mutation updateAIChatConfig($chatGPTApiKey: String!) {
    updateAIChatConfig(chatGPTApiKey: $chatGPTApiKey) {
      chatGPTApiKey
    }
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
