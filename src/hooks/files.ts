import { ref, type Ref } from 'vue'
import type { ApolloCache, ApolloError } from '@apollo/client/core'
import { copyFileGQL, createDirGQL, initMutation, moveFileGQL, renameFileGQL } from '@/lib/api/mutation'
import { FilePanel, isAudio, isImage, isVideo, type IFile } from '@/lib/file'
import { filesGQL, initQuery, recentFilesGQL, storageStatsGQL } from '@/lib/api/query'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { download, encryptUrlParams, getFileId, getFileName, getFileUrlByPath } from '@/lib/api/file'
import type { ISource } from '@/components/lightbox/types'
import { storeToRefs } from 'pinia'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { encodeBase64 } from '@/lib/strutil'
import { replacePathNoReload } from '@/plugins/router'
import { buildQuery, type IFilterField } from '@/lib/search'
import type { MainState } from '@/stores/main'
import { findIndex, remove } from 'lodash-es'
import { getApiBaseUrl } from '@/lib/api/api'
import type { IStorageStats, IStorageStatsItem } from '@/lib/interfaces'
import type sjcl from 'sjcl'

export const useCreateDir = (urlTokenKey: Ref<sjcl.BitArray | null>, panels: Ref<FilePanel[]>) => {
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
            // TODO: check created failed or not?
            for (const panel of panels.value) {
              if (panel.dir === createPath.value) {
                const d = data.data.createDir
                panel.items.push({ ...d, name: getFileName(d.path), fileId: getFileId(urlTokenKey.value, d.path) })
              }
            }
          },
        },
        appApi: true,
      })
    },
  }
}

export const useRename = (panels: Ref<FilePanel[]>) => {
  const renameValue = ref('')
  const renamePath = ref('')
  return {
    renameValue,
    renamePath,
    renameDone(newName: string) {
      const path = renamePath.value
      const oldName = renameValue.value
      for (const panel of panels.value) {
        panel.rename(path, oldName, newName)
      }
    },
    renameMutation() {
      return initMutation({
        document: renameFileGQL,
        appApi: true,
      })
    },
    renameVariables(value: string) {
      return { path: renamePath.value, name: value }
    },
  }
}

export const useDeleteFiles = (panels: Ref<FilePanel[]>, currentDir: Ref<string>, refetchStats: () => void) => {
  return {
    onDeleted(files: IFile[]) {
      for (const panel of panels.value) {
        files.forEach((f) => {
          panel.deleteItem(f.path)
        })
      }

      files.forEach((f) => {
        if (currentDir.value.startsWith(f.path)) {
          const index = f.path.lastIndexOf('/')
          currentDir.value = f.path.substring(0, index) // jump the path to parent
        }
      })

      refetchStats()
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
    appApi: true,
  })

  return { internal, sdcard, usb, refetch }
}

export const useFiles = (urlTokenKey: Ref<sjcl.BitArray | null>, rootDir: string, initDir: string, sortBy: Ref<string>) => {
  const currentDir = ref(rootDir)
  const _refetchDir = ref('')

  const panels = ref<FilePanel[]>([])
  const { t } = useI18n()
  let initDirIndex = 0
  let inited = false

  const { loading } = initQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        const { dir, items } = data.files
        const files: IFile[] = []
        for (const item of items) {
          const tmp = { ...item, name: getFileName(item.path) }
          if (isVideo(tmp.name) || isImage(tmp.name)) {
            tmp.fileId = getFileId(urlTokenKey.value, item.path)
          }
          files.push(tmp)
        }

        const panelCount = dir.replace(rootDir, '').split('/').length
        while (panels.value.length >= panelCount) {
          panels.value.pop()
        }
        panels.value.push(new FilePanel(dir, files))
        if (initDir && !inited) {
          const dirs = initDir.replace(rootDir + '/', '').split('/')
          if (files.length === 0) {
            inited = true
          } else {
            if (initDirIndex < dirs.length) {
              currentDir.value = rootDir + '/' + dirs.slice(0, initDirIndex + 1).join('/')
              initDirIndex++
            } else {
              inited = true
            }
          }
        }
      }
    },
    document: filesGQL,
    variables: () => ({
      dir: currentDir.value,
      showHidden: true,
      sortBy: sortBy.value,
    }),
    options: {
      fetchPolicy: 'no-cache',
    },
    appApi: true,
  })

  const { refetch } = initQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        const { dir, items } = data.files
        const list: IFile[] = []
        for (const item of items) {
          list.push({ ...item, name: getFileName(item.path), fileId: getFileId(urlTokenKey.value, item.path) })
        }
        panels.value.forEach((panel: FilePanel) => {
          if (panel.dir === dir) {
            panel.items = list
          }
        })
      }
      _refetchDir.value = ''
    },
    document: filesGQL,
    variables: () => ({
      dir: _refetchDir.value,
      showHidden: true,
      sortBy: sortBy.value,
    }),
    options: () => ({
      fetchPolicy: 'no-cache',
      enabled: !!_refetchDir.value,
    }),
    appApi: true,
  })

  return {
    loading,
    panels,
    refetch(dir: string) {
      _refetchDir.value = dir
      refetch()
    },
    currentDir,
  }
}

export const useRecentFiles = (urlTokenKey: Ref<sjcl.BitArray | null>) => {
  const { t } = useI18n()
  const files = ref<IFile[]>([])

  const { loading } = initQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        const items = data.recentFiles
        for (const item of items) {
          const tmp = { ...item, name: getFileName(item.path) }
          if (isVideo(tmp.name) || isImage(tmp.name)) {
            tmp.fileId = getFileId(urlTokenKey.value, item.path)
          }
          files.value.push(tmp)
        }
      }
    },
    document: recentFilesGQL,
    options: {
      fetchPolicy: 'no-cache',
    },
    appApi: true,
  })

  return {
    files,
    loading,
  }
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
          src: '',
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

export const useSingleSelect = (currentDir: Ref<string>, filesType: string, q: Ref<string>, mainStore: MainState) => {
  const selectedItem = ref<IFile | null>(null)

  return {
    selectedItem,
    select(panel: FilePanel, item: IFile) {
      if (item.isDir) {
        currentDir.value = item.path
      } else {
        if (panel.items.some((it) => it.path === currentDir.value) && panel.items.some((it) => it.path === item.path)) {
          currentDir.value = panel.dir
        }
      }
      const fileds: IFilterField[] = []
      fileds.push({
        name: 'path',
        op: '',
        value: item.path,
      })
      fileds.push({
        name: 'isDir',
        op: '',
        value: currentDir.value === item.path ? '1' : '0',
      })
      q.value = buildQuery(fileds)
      selectedItem.value = item

      replacePathNoReload(mainStore, filesType ? `/files/${filesType}?q=${encodeBase64(q.value)}` : `/files?q=${encodeBase64(q.value)}`)
    },
  }
}

export const useCopyPaste = (selectedFiles: Ref<IFile[]>, refetchFiles: (path: string) => void, refetchStats: () => void) => {
  const isCut = ref(false)
  const dstDir = ref<string>()

  const {
    mutate: copyMutate,
    loading: copyLoading,
    onDone: copyDone,
    onError: copyError,
  } = initMutation({
    document: copyFileGQL,
    appApi: true,
  })

  const {
    mutate: cutMutate,
    loading: cutLoading,
    onDone: cutDone,
    onError: cutError,
  } = initMutation({
    document: moveFileGQL,
    appApi: true,
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
        remove(file.panel?.items ?? [], (it: IFile) => it.path === file.path)
      }
    }

    // have to delay 1s to make sure the api return latest data.
    setTimeout(() => {
      refetchFiles(dstDir.value!)
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
    copy(items: IFile[]) {
      selectedFiles.value = items
      isCut.value = false
    },
    cut(items: IFile[]) {
      selectedFiles.value = items
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

export const useFileUpload = () => {
  const { uploads } = storeToRefs(useTempStore())

  const _dir = ref('')
  const input = ref<HTMLInputElement>()
  return {
    input,
    upload(dir: string) {
      _dir.value = dir
      input.value!.value = ''
      input.value!.click()
    },
    uploadChanged(e: Event) {
      const files = (e.target as HTMLInputElement).files
      if (!files) {
        return
      }
      const items = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        items.push({
          dir: _dir.value,
          fileName: '',
          file,
          status: 'created',
          uploadedSize: 0,
          error: '',
        })
      }
      uploads.value = [...uploads.value, ...items]
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

export const useChatFilesUpload = () => {
  return {
    getUploads(baseDir: string, files: File[]): IUploadItem[] {
      const items = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        items.push({
          dir: baseDir + '/' + getFileDir(file.name),
          fileName: file.name,
          file,
          status: 'created',
          uploadedSize: 0,
          error: '',
        })
      }
      return items
    },
  }
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
