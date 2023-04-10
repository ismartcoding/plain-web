import { ref, type Ref } from 'vue'
import type { ApolloCache, ApolloError } from '@apollo/client/core'
import { copyFileGQL, createDirGQL, initMutation, moveFileGQL, renameFileGQL } from '@/lib/api/mutation'
import { FilePanel, isAudio, isImage, isVideo, type IFile } from '@/lib/file'
import { filesGQL, initQuery, storageStatsGQL } from '@/lib/api/query'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import { download, getFileId, getFileName, getFileUrlByPath } from '@/lib/api/file'
import type { ISource } from '@/components/lightbox/types'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { encodeBase64 } from '@/lib/strutil'
import { replacePathNoReload } from '@/plugins/router'
import { buildQuery, type IFilterField } from '@/lib/search'
import type { MainState } from '@/stores/main'
import { findIndex } from 'lodash-es'

export const useCreateDir = (app: Ref<any>, panels: Ref<FilePanel[]>) => {
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
            const { fileIdToken } = app.value
            for (const panel of panels.value) {
              if (panel.dir === createPath.value) {
                const d = data.data.createDir
                panel.items.push({ ...d, name: getFileName(d.path), fileId: await getFileId(fileIdToken, d.path) })
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

export const useDelete = (panels: Ref<FilePanel[]>, currentDir: Ref<string>, refetchStats: () => void) => {
  return {
    onDeleted(f: IFile) {
      for (const panel of panels.value) {
        panel.deleteItem(f.path)
      }

      if (currentDir.value.startsWith(f.path)) {
        const index = f.path.lastIndexOf('/')
        currentDir.value = f.path.substring(0, index) // jump the path to parent
      }
      refetchStats()
    },
  }
}

export const useStats = () => {
  const totalBytes = ref(0)
  const freeBytes = ref(0)
  const { refetch } = initQuery({
    handle: (data: any, error: string) => {
      if (!error) {
        totalBytes.value = data.storageStats.totalBytes
        freeBytes.value = data.storageStats.freeBytes
      }
    },
    document: storageStatsGQL,
    appApi: true,
  })

  return { totalBytes, freeBytes, refetch }
}

export const useFiles = (app: Ref<any>, initDir: string) => {
  const rootDir = ref('')
  const _refetchDir = ref('')
  const currentDir = ref('')
  const panels = ref<FilePanel[]>([])
  const { t } = useI18n()
  let initDirIndex = 0

  const { loading } = initQuery({
    handle: async (data: any, error: string) => {
      if (error) {
        toast(t(error), 'error')
      } else {
        const { dir, items } = data.files
        if (currentDir.value === '') {
          rootDir.value = dir
        }
        const { fileIdToken } = app.value
        const list: IFile[] = []
        for (const item of items) {
          const tmp = { ...item, name: getFileName(item.path) }
          if (isVideo(tmp.name) || isImage(tmp.name)) {
            tmp.fileId = await getFileId(fileIdToken, item.path)
          }
          list.push(tmp)
        }

        const panelCount = dir.replace(rootDir.value, '').split('/').length
        while (panels.value.length >= panelCount) {
          panels.value.pop()
        }
        panels.value.push(new FilePanel(dir, list))
        if (initDir) {
          const dirs = initDir.replace(rootDir.value + '/', '').split('/')
          if (list.length === 0) {
            initDirIndex = dirs.length - 1 // the folder may be deleted, just ignore the next request.
          } else {
            if (initDirIndex < dirs.length) {
              currentDir.value = rootDir.value + '/' + dirs.slice(0, initDirIndex + 1).join('/')
              initDirIndex++
            }
          }
        }
      }
    },
    document: filesGQL,
    variables: {
      dir: currentDir,
      showHidden: true,
    },
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
        const { fileIdToken } = app.value
        const list: IFile[] = []
        for (const item of items) {
          list.push({ ...item, name: getFileName(item.path), fileId: await getFileId(fileIdToken, item.path) })
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
    variables: {
      dir: _refetchDir,
      showHidden: true,
    },
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
    rootDir,
    currentDir,
  }
}

export const useDownload = (app: Ref<any>) => {
  return {
   async download(path: string) {
    const { fileIdToken } = app.value
      const url = await getFileUrlByPath(fileIdToken, path)
      download(url + '&dl=1', getFileName(path))
    },
  }
}

export const useView = (sources: Ref<ISource[]>, ivView: (i: number) => void) => {
  return {
    view(panel: FilePanel, f: IFile) {
      sources.value = panel.items
        .filter((it) => isImage(it.name) || isVideo(it.name) || isAudio(it.name))
        .map((it) => ({
          path: it.path,
          src: '',
          name: getFileName(it.path),
        }))
      const index = findIndex(sources.value, (it: ISource) => it.path === f.path)
      ivView(index)
    },
  }
}

export const useSingleSelect = (currentDir: Ref<string>, q: Ref<string>, mainStore: MainState) => {
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
        name: 'dir',
        op: '',
        value: currentDir.value,
      })
      q.value = buildQuery(fileds)
      selectedItem.value = item
      replacePathNoReload(mainStore, `/files?q=${encodeBase64(q.value)}`)
    },
  }
}

export const useCopyPaste = (refetchFiles: (path: string) => void, refetchStats: () => void) => {
  const selectItem = ref<IFile | null>(null)
  const srcPanel = ref<FilePanel | null>(null)
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
      const index = srcPanel.value!.items.findIndex((it) => it.path === selectItem.value!.path)
      srcPanel.value?.items.splice(index, 1)
    }
    selectItem.value = null
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
      return !!selectItem.value
    },
    copy(item: IFile) {
      selectItem.value = item
      isCut.value = false
    },
    cut(panel: FilePanel, item: IFile) {
      selectItem.value = item
      srcPanel.value = panel
      isCut.value = true
    },
    paste(dir: string) {
      dstDir.value = dir
      const a = {
        src: selectItem.value?.path,
        dst: dir + '/' + selectItem.value?.name,
        overwrite: false,
      }
      if (isCut.value) {
        cutMutate(a)
      } else {
        copyMutate(a)
      }
    },
  }
}

export const useUpload = () => {
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
