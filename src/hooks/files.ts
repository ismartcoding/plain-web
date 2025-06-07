import { ref, type Ref } from 'vue'
import type { ApolloCache, ApolloError } from '@apollo/client/core'
import { copyFileGQL, createDirGQL, initMutation, moveFileGQL, renameFileGQL } from '@/lib/api/mutation'
import { enrichFile, isAudio, isImage, isVideo, type IFile } from '@/lib/file'
import { initQuery, storageStatsGQL } from '@/lib/api/query'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { download, encryptUrlParams, getFileId, getFileName, getFileUrl, getFileUrlByPath } from '@/lib/api/file'
import type { ISource } from '@/components/lightbox/types'
import { encodeBase64 } from '@/lib/strutil'
import { buildQuery, parseQuery, type IFilterField } from '@/lib/search'
import { findIndex, remove } from 'lodash-es'
import { getApiBaseUrl } from '@/lib/api/api'
import type { IApp, IFileFilter, IStorageStats, IStorageStatsItem } from '@/lib/interfaces'
import type sjcl from 'sjcl'

export const useCreateDir = (urlTokenKey: Ref<sjcl.BitArray | null>, items: Ref<IFile[]>) => {
  const createPath = ref('')

  return {
    createPath,
    createVariables(value: string) {
      return { path: createPath.value + '/' + value }
    },
    createMutation() {
      return initMutation({
        document: createDirGQL,
        options: {
          update: async (_: ApolloCache<any>, data: any) => {
            const d = data.data.createDir
            remove(items.value, (it: IFile) => it.path === d.path)
            items.value.unshift(enrichFile(d, urlTokenKey.value))
          },
        },
      })
    },
  }
}

export const useRename = (fetch: () => void) => {
  const renameItem = ref<IFile>()
  return {
    renameItem,
    renameDone(newName: string) {
      fetch()
    },
    renameMutation() {
      return initMutation({
        document: renameFileGQL,
      })
    },
    renameVariables(value: string) {
      return { path: renameItem.value?.path, name: value }
    },
  }
}

export const useStats = () => {
  const internal = ref<IStorageStatsItem | null>(null)
  const sdcard = ref<IStorageStatsItem | null>(null)
  const usb = ref<IStorageStatsItem[]>([])
  const { refetch } = initQuery({
    handle: (data: { storageStats: IStorageStats }, error: string) => {
      if (!error) {
        internal.value = data.storageStats.internal
        sdcard.value = data.storageStats.sdcard
        usb.value = data.storageStats.usb
      }
    },
    document: storageStatsGQL,
  })

  return { internal, sdcard, usb, refetch }
}

export const useDownload = (urlTokenKey: Ref<sjcl.BitArray | null>) => {
  return {
    async downloadFile(path: string, fileName?: string) {
      const url = getFileUrlByPath(urlTokenKey.value, path)
      if (fileName) {
        download(url + `&dl=1&name=${fileName}`, fileName)
      } else {
        download(url + '&dl=1', getFileName(path))
      }
    },
    async downloadDir(path: string, fileName?: string) {
      const id = getFileId(urlTokenKey.value, path)
      const url = `${getApiBaseUrl()}/zip/dir?id=${encodeURIComponent(id)}`
      if (fileName) {
        download(url + `&name=${fileName}`, fileName)
      } else {
        download(url, getFileName(path))
      }
    },
    downloadFiles(key: string) {
      const id = encryptUrlParams(
        urlTokenKey.value,
        JSON.stringify({
          id: key,
          type: 'FILE',
          name: '',
        })
      )

      download(`${getApiBaseUrl()}/zip/files?id=${encodeURIComponent(id)}`, '')
    },
  }
}

export const useView = (sources: Ref<ISource[]>, ivView: (sources: ISource[], i: number) => void) => {
  return {
    view(items: IFile[], f: IFile) {
      sources.value = items
        .filter((it) => isImage(it.name) || isVideo(it.name) || isAudio(it.name))
        .map((it) => ({
          path: it.path,
          src: it.fileId ? getFileUrl(it.fileId) : '',
          name: getFileName(it.path),
          size: it.size,
          duration: 0,
          data: f,
        }))
      const index = findIndex(sources.value, (it: ISource) => it.path === f.path)
      ivView(sources.value, index)
    },
  }
}

export const useCopyPaste = (items: Ref<IFile[]>, isCut: Ref<boolean>, selectedFiles: Ref<IFile[]>, refetchFiles: () => void, refetchStats: () => void) => {
  const dstDir = ref<string>()

  const {
    mutate: copyMutate,
    loading: copyLoading,
    onDone: copyDone,
    onError: copyError,
  } = initMutation({
    document: copyFileGQL,
  })

  const {
    mutate: cutMutate,
    loading: cutLoading,
    onDone: cutDone,
    onError: cutError,
  } = initMutation({
    document: moveFileGQL,
  })

  const { t } = useI18n()

  const onError = (error: ApolloError) => {
    toast(t(error.message))
  }

  copyError(onError)
  cutError(onError)

  const onDone = () => {
    if (isCut.value) {
      for (const file of selectedFiles.value) {
        remove(items.value, (it: IFile) => it.path === file.path)
      }
    }

    selectedFiles.value = []

    // have to delay 1s to make sure the api return latest data.
    setTimeout(() => {
      refetchFiles()
      refetchStats()
    }, 500)
  }

  copyDone(onDone)
  cutDone(onDone)

  return {
    loading: copyLoading || cutLoading,
    canPaste() {
      return selectedFiles.value.length > 0
    },
    copy(ids: string[]) {
      selectedFiles.value = items.value.filter((it) => ids.includes(it.id))
      isCut.value = false
    },
    cut(ids: string[]) {
      selectedFiles.value = items.value.filter((it) => ids.includes(it.id))
      isCut.value = true
    },
    paste(dir: string) {
      dstDir.value = dir
      for (const file of selectedFiles.value) {
        const a = {
          src: file.path,
          dst: dir + '/' + file.name,
          overwrite: false,
        }
        if (isCut.value) {
          cutMutate(a)
        } else {
          copyMutate(a)
        }
      }
    },
  }
}

export function getFileDir(fileName: string) {
  let dir = 'Documents'
  if (isImage(fileName)) {
    dir = 'Pictures'
  } else if (isVideo(fileName)) {
    dir = 'Movies'
  } else if (isAudio(fileName)) {
    dir = 'Music'
  }
  return dir
}

export const useDownloadItems = (urlTokenKey: Ref<sjcl.BitArray | null>, type: string, clearSelection: () => void, fileName: string) => {
  const { t } = useI18n()

  return {
    downloadItems: (realAllChecked: boolean, ids: string[], query: string) => {
      let q = query
      if (!realAllChecked) {
        if (ids.length === 0) {
          toast(t('select_first'), 'error')
          return
        }
        q = `ids:${ids.join(',')}`
      }

      const id = encryptUrlParams(
        urlTokenKey.value,
        JSON.stringify({
          query: q,
          type: type,
          name: fileName,
        })
      )
      download(`${getApiBaseUrl()}/zip/files?id=${encodeURIComponent(id)}`, fileName)
      clearSelection()
    },
  }
}

export const getRootDir = (filesType: string, app: IApp) => {
  let rootDir = app.internalStoragePath
  if (filesType) {
    if (filesType === 'sdcard') {
      rootDir = app.sdcardPath
    } else if (filesType.startsWith('usb')) {
      rootDir = app.usbDiskPaths[parseInt(filesType.substring(3)) - 1]
    } else if (filesType === 'app') {
      rootDir = app.externalFilesDir
    }
  }
  return rootDir
}

export const useSearch = () => {
  return {
    parseQ: (filter: IFileFilter, q: string) => {
      const fields = parseQuery(q)
      filter.showHidden = false
      filter.text = ''
      filter.parent = ''
      filter.linkName = ''
      fields.forEach((it) => {
        if (it.name === 'text') {
          filter.text = it.value
        } else if (it.name === 'parent') {
          filter.parent = it.value
        } else if (it.name === 'link_name') {
          filter.linkName = it.value
        } else if (it.name === 'show_hidden') {
          filter.showHidden = it.value === 'true'
        }
      })
    },
    buildQ: (filter: IFileFilter): string => {
      const fields: IFilterField[] = []
      if (filter.parent !== '') {
        fields.push({
          name: 'parent',
          op: '',
          value: filter.parent,
        })
      }

      if (filter.linkName !== '') {
        fields.push({
          name: 'link_name',
          op: '',
          value: filter.linkName,
        })
      }

      if (filter.text !== '') {
        fields.push({
          name: 'text',
          op: '',
          value: filter.text,
        })
      }

      if (filter.showHidden) {
        fields.push({
          name: 'show_hidden',
          op: '',
          value: filter.showHidden ? 'true' : 'false',
        })
      }

      return encodeBase64(buildQuery(fields))
    },
  }
}
