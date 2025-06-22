<template>
  <left-sidebar>
    <template #title>
      {{ $t('page_title.files') }}
    </template>
    <template #body>
      <ul class="nav">
        <li v-for="item in links" :key="item.fullPath" :class="{ active: item.isChecked }" @click.prevent="openLink(item)">
          <span class="title">{{ item.title }}</span>
          <v-icon-button 
            v-if="item.isFavoriteFolder" 
            :id="'favorite-' + item.fullPath" 
            v-tooltip="$t('actions')" 
            class="sm" 
            @click.prevent.stop="showFavoriteMenu(item)"
          >
            <i-material-symbols:more-vert />
          </v-icon-button>
        </li>
      </ul>
      <v-dropdown-menu v-model="favoriteMenuVisible" :anchor="'favorite-' + selectedFavorite?.fullPath">
        <div class="dropdown-item" @click="removeFavoriteFolder(selectedFavorite!); favoriteMenuVisible = false">
          {{ $t('remove_from_favorites') }}
        </div>
      </v-dropdown-menu>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { computed, reactive, ref, watch } from 'vue'
import { buildQuery } from '@/lib/search'
import type { IFileFilter, IFavoriteFolder } from '@/lib/interfaces'
import { useSearch } from '@/hooks/files'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { useI18n } from 'vue-i18n'
import { initMutation, removeFavoriteFolderGQL } from '@/lib/api/mutation'
import toast from '@/components/toaster'
import emitter from '@/plugins/eventbus'
import { getStorageTypeByRootPath } from '@/lib/file'

const route = useRoute()
const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const { t } = useI18n()

const { parseQ } = useSearch()
const filter = reactive<IFileFilter>({
  showHidden: false,
  type: '',
  rootPath: '',
  text: '',
  parent: '',
})

const parent = ref('')
const recent = ref(false)
const favoriteMenuVisible = ref(false)
const selectedFavorite = ref<LinkItem | null>(null)

function openRecent() {
  replacePath(mainStore, '/files/recent')
}

function showFavoriteMenu(item: LinkItem) {
  selectedFavorite.value = item
  // Close other dropdowns before opening this one
  const anchorElement = document.getElementById('favorite-' + item.fullPath)
  document.dispatchEvent(new CustomEvent('dropdown-toggle', { detail: { exclude: anchorElement } }))
  favoriteMenuVisible.value = true
}

const { mutate: removeFavoriteFolderMutation, loading: removingFavorite } = initMutation({
  document: removeFavoriteFolderGQL,
  options: {
    update: () => {
      // Refetch app data to update favorites list
      emitter.emit('refetch_app')
    },
  },
})

function removeFavoriteFolder(item: LinkItem) {
  removeFavoriteFolderMutation({ 
    fullPath: item.fullPath 
  }).then(() => {
    toast(t('removed'))
  }).catch((error) => {
    console.error('Error removing favorite folder:', error)
    toast(t('error'), 'error')
  })
}

interface LinkItem {
  rootPath: string
  fullPath: string
  type: string
  title: string
  isChecked: boolean
  isFavoriteFolder: boolean
}

const links = computed(() => {
  // Helper function to find the longest matching prefix for current path
  const findLongestMatch = (currentPath: string): string => {
    const allPaths = [
      app.value.internalStoragePath,
      app.value.externalFilesDir,
      ...(app.value.sdcardPath ? [app.value.sdcardPath] : []),
      ...app.value.usbDiskPaths,
      ...(app.value.favoriteFolders?.map(f => f.fullPath) || [])
    ]
    
    let longestMatch = ''
    allPaths.forEach(path => {
      if (currentPath.startsWith(path) && path.length > longestMatch.length) {
        longestMatch = path
      }
    })
    
    return longestMatch
  }

  // Helper function to generate display title for favorite folders
  const generateFavoriteDisplayTitle = (favoriteFolder: IFavoriteFolder): string => {
    const rootName = (() => {
      if (favoriteFolder.rootPath === app.value.internalStoragePath) return t('internal_storage')
      if (favoriteFolder.rootPath === app.value.externalFilesDir) return t('app_data')
      if (favoriteFolder.rootPath === app.value.sdcardPath) return t('sdcard')
      
      const usbIndex = app.value.usbDiskPaths.indexOf(favoriteFolder.rootPath)
      if (usbIndex !== -1) return `${t('usb_storage')} ${usbIndex + 1}`
      
      return favoriteFolder.rootPath
    })()

    // Calculate relative path from root to favorite folder
    const relativePath = favoriteFolder.fullPath.startsWith(favoriteFolder.rootPath)
      ? favoriteFolder.fullPath.substring(favoriteFolder.rootPath.length).replace(/^\//, '')
      : favoriteFolder.fullPath.split('/').pop() || ''

    return relativePath ? `${rootName}/${relativePath}` : rootName
  }

  // If on recent page, don't match any path to ensure mutual exclusivity
  const longestMatchPath = recent.value ? '' : findLongestMatch(parent.value)
  const links: LinkItem[] = []

  links.push({
    rootPath: '',
    fullPath: '',
    type: 'RECENTS',
    title: t('recents'),
    isChecked: recent.value,
    isFavoriteFolder: false
  })

  // Internal Storage
  links.push({
    rootPath: app.value.internalStoragePath,
    fullPath: app.value.internalStoragePath,
    type: 'INTERNAL_STORAGE',
    title: t('internal_storage'),
    isChecked: longestMatchPath === app.value.internalStoragePath,
    isFavoriteFolder: false
  })

  // SD Card (if available)
  if (app.value.sdcardPath) {
    links.push({
      rootPath: app.value.sdcardPath,
      fullPath: app.value.sdcardPath,
      type: 'SDCARD',
      title: t('sdcard'),
      isChecked: longestMatchPath === app.value.sdcardPath,
      isFavoriteFolder: false
    })
  }

  // USB Storage (if available)
  app.value.usbDiskPaths.forEach((path, index) => {
    links.push({
      rootPath: path,
      fullPath: path,
      type: 'USB_STORAGE',
      title: `${t('usb_storage')} ${index + 1}`,
      isChecked: longestMatchPath === path,
      isFavoriteFolder: false
    })
  })

  // App Storage
  links.push({
    rootPath: app.value.externalFilesDir,
    fullPath: app.value.externalFilesDir,
    type: 'APP',
    title: t('app_data'),
    isChecked: longestMatchPath === app.value.externalFilesDir,
    isFavoriteFolder: false
  })

  // Favorite folders
  if (app.value.favoriteFolders && app.value.favoriteFolders.length > 0) {
    app.value.favoriteFolders.forEach((folder: IFavoriteFolder, index: number) => {
      const displayTitle = generateFavoriteDisplayTitle(folder)
      
      // Determine type based on rootPath
      const folderType = getStorageTypeByRootPath(folder.rootPath, {
        internalStoragePath: app.value.internalStoragePath,
        externalFilesDir: app.value.externalFilesDir,
        sdcardPath: app.value.sdcardPath,
        usbDiskPaths: app.value.usbDiskPaths
      })
      
      links.push({
        rootPath: folder.rootPath,
        fullPath: folder.fullPath,
        type: folderType,
        title: displayTitle,
        isChecked: longestMatchPath === folder.fullPath,
        isFavoriteFolder: true
      })
    })
  }

  return links
})

function openLink(link: LinkItem) {
  if (link.type === 'RECENTS') {
    openRecent()
    return
  }

  const q = buildQuery([
    {
      name: 'parent',
      op: '',
      value: link.fullPath,
    },
    {
      name: 'type',
      op: '',
      value: link.type,
    },
    {
      name: 'root_path',
      op: '',
      value: link.rootPath,
    },
  ])
  replacePath(mainStore, `/files?q=${encodeBase64(q)}`)
}

function updateActive() {
  const route = router.currentRoute.value
  if (route.path === '/files/recent') {
    recent.value = true
    return
  }

  recent.value = false
  const q = decodeBase64(route.query.q?.toString() ?? '')
  parseQ(filter, q)
  parent.value = filter.parent
}

updateActive()

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    updateActive()
  }
)
</script>
