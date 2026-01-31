<template>
  <left-sidebar class="files-sidebar">
    <template #body>
      <ul class="nav">
        <li v-for="item in quickLinks" :key="item.type" :class="{ active: item.isChecked }" @click.prevent="openLink(item)">
          <span class="icon" aria-hidden="true">
            <i-lucide:history v-if="item.type === 'RECENTS'" />
          </span>
          <span class="title">{{ item.title }}</span>
        </li>
      </ul>

      <div class="section-title">
        {{ $t('volumes') }}
      </div>
      <div class="volumes">
        <VolumeCard
          v-for="item in volumeLinks" :key="item.fullPath" :title="item.title" :count="item.count || ''" :data="item"
          :used-percent="item.usedPercent || 0" :percent-class="percentClass(item.usedPercent)" :active="item.isChecked"
          :show-progress="item.showProgress" @click="openLink(item)"
        />
      </div>

      <template v-if="favoriteLinks.length">
        <div class="section-title">{{ $t('favorites') }}</div>
        <ul class="nav">
          <li v-for="item in favoriteLinks" :key="item.fullPath" :class="{ active: item.isChecked }" @click.prevent="openLink(item)">
            <span class="title">{{ item.title }}</span>
            <v-icon-button
              :id="'favorite-' + item.fullPath" v-tooltip="$t('actions')" class="sm"
              @click.prevent.stop="showFavoriteMenu(item)"
            >
              <i-material-symbols:more-vert />
            </v-icon-button>
          </li>
        </ul>
      </template>

      <v-dropdown-menu v-model="favoriteMenuVisible" :anchor="'favorite-' + selectedFavorite?.fullPath">
        <div class="dropdown-item" @click="openSetFavoriteAlias(); favoriteMenuVisible = false">{{ $t('rename') }}</div>
        <div class="dropdown-item" @click="removeFavoriteFolder(selectedFavorite!); favoriteMenuVisible = false">
          {{ $t('remove_from_favorites') }}
        </div>
      </v-dropdown-menu>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import router, { replacePath } from '@/plugins/router'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import { useTempStore } from '@/stores/temp'
import { computed, reactive, ref, watch } from 'vue'
import { buildQuery } from '@/lib/search'
import type { IFileFilter, IFavoriteFolder, IStorageMount } from '@/lib/interfaces'
import { useSearch } from '@/hooks/files'
import { decodeBase64, encodeBase64 } from '@/lib/strutil'
import { useI18n } from 'vue-i18n'
import { initMutation, removeFavoriteFolderGQL, setFavoriteFolderAliasGQL } from '@/lib/api/mutation'
import toast from '@/components/toaster'
import emitter from '@/plugins/eventbus'
import { formatFileSize } from '@/lib/format'
import { useMounts } from '@/hooks/files'
import VolumeCard from '@/components/storage/VolumeCard.vue'
import { openModal } from '@/components/modal'
import EditValueModal from '@/components/EditValueModal.vue'

const mainStore = useMainStore()
const { app } = storeToRefs(useTempStore())
const { t } = useI18n()

const { mounts } = useMounts()

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

function openSetFavoriteAlias() {
  const item = selectedFavorite.value
  if (!item) return

  const current = app.value.favoriteFolders?.find((f) => f.fullPath === item.fullPath)
  const currentAlias = (current?.alias || '').trim()

  const mutationFactory = () =>
    initMutation({
      document: setFavoriteFolderAliasGQL,
      options: {
        update: () => {
          emitter.emit('refetch_app')
        },
      },
    })

  openModal(EditValueModal, {
    title: t('name'),
    placeholder: item.title || '',
    value: currentAlias || '',
    mutation: mutationFactory,
    getVariables: (value: string) => ({
      fullPath: item.fullPath,
      alias: (value || '').trim(),
    }),
    done: () => {
      toast(t('saved'))
    },
  })
}

interface LinkItem {
  rootPath: string
  fullPath: string
  type: string
  title: string
  isChecked: boolean
  isFavoriteFolder: boolean
  count?: string
  usedPercent?: number
  showProgress?: boolean
}

const links = computed(() => {
  // Helper function to find the longest matching prefix for current path
  const findLongestMatch = (currentPath: string): string => {
    const allPaths = [
      ...mounts.value.map((m) => m.mountPoint).filter(Boolean),
      ...(app.value.favoriteFolders?.map((f) => f.fullPath) || []),
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
    const alias = (favoriteFolder.alias || '').trim()
    if (alias) return alias

    const usbMountPoints = mounts.value
      .filter((m) => m.driveType === 'USB_STORAGE')
      .map((m) => m.mountPoint)
      .filter(Boolean)
    const usbIndexByMountPoint = new Map<string, number>(usbMountPoints.map((p, i) => [p, i + 1]))

    const mountTitle = (m?: IStorageMount | null): string => {
      if (!m) return ''
      if (m.driveType === 'INTERNAL_STORAGE') return t('internal_storage')
      if (m.driveType === 'APP') return t('app_data')
      if (m.driveType === 'SDCARD') return t('sdcard')
      if (m.driveType === 'USB_STORAGE') {
        const idx = usbIndexByMountPoint.get(m.mountPoint) ?? 1
        return `${t('usb_storage')} ${idx}`
      }
      return m.name || m.mountPoint
    }

    const rootName = (() => {
      const m = mounts.value.find((it) => it.mountPoint === favoriteFolder.rootPath)
      return mountTitle(m) || favoriteFolder.rootPath
    })()

    // Calculate relative path from root to favorite folder
    const relativePath = favoriteFolder.fullPath.startsWith(favoriteFolder.rootPath)
      ? favoriteFolder.fullPath.substring(favoriteFolder.rootPath.length).replace(/^\//, '')
      : favoriteFolder.fullPath.split('/').pop() || ''

    return relativePath ? `${rootName}/${relativePath}` : rootName
  }

  const storageCount = (freeBytes: number, totalBytes: number) => {
    if (totalBytes <= 0) return ''
    return t('storage_free_total', {
      free: formatFileSize(freeBytes),
      total: formatFileSize(totalBytes),
    })
  }

  const usedPct = (freeBytes: number, totalBytes: number) => {
    if (totalBytes <= 0) return 0
    const usedBytes = Math.max(0, totalBytes - freeBytes)
    return (usedBytes / totalBytes) * 100
  }

  const mountTitle = (m: IStorageMount, usbIndexByMountPoint: Map<string, number>) => {
    if (m.driveType === 'INTERNAL_STORAGE') return t('internal_storage')
    if (m.driveType === 'APP') return t('app_data')
    if (m.driveType === 'SDCARD') return t('sdcard')
    if (m.driveType === 'USB_STORAGE') {
      const idx = usbIndexByMountPoint.get(m.mountPoint) ?? 1
      return `${t('usb_storage')} ${idx}`
    }
    return m.name || m.mountPoint
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

  const usbMountPoints = mounts.value
    .filter((m) => m.driveType === 'USB_STORAGE')
    .map((m) => m.mountPoint)
    .filter(Boolean)
  const usbIndexByMountPoint = new Map<string, number>(usbMountPoints.map((p, i) => [p, i + 1]))

  const driveRank = (m: IStorageMount) => {
    if (m.driveType === 'INTERNAL_STORAGE') return 0
    if (m.driveType === 'SDCARD') return 1
    if (m.driveType === 'USB_STORAGE') return 2
    if (m.driveType === 'APP') return 3
    return 9
  }

  const sortedMounts = [...mounts.value].sort((a, b) => {
    const da = driveRank(a)
    const db = driveRank(b)
    if (da !== db) return da - db
    return (a.mountPoint || '').localeCompare(b.mountPoint || '')
  })

  sortedMounts.forEach((m) => {
    const mp = m.mountPoint
    if (!mp) return
    const total = Number(m.totalBytes || 0)
    const free = Number(m.freeBytes || 0)
    links.push({
      rootPath: mp,
      fullPath: mp,
      type: m.driveType || '',
      title: mountTitle(m, usbIndexByMountPoint),
      isChecked: longestMatchPath === mp,
      isFavoriteFolder: false,
      count: storageCount(free, total),
      usedPercent: usedPct(free, total),
      showProgress: total > 0,
    })
  })

  // Favorite folders
  if (app.value.favoriteFolders && app.value.favoriteFolders.length > 0) {
    app.value.favoriteFolders.forEach((folder: IFavoriteFolder, index: number) => {
      const displayTitle = generateFavoriteDisplayTitle(folder)
      
      const folderType = mounts.value.find((m) => m.mountPoint === folder.rootPath)?.driveType ?? ''
      
      links.push({
        rootPath: folder.rootPath,
        fullPath: folder.fullPath,
        type: folderType,
        title: displayTitle,
        isChecked: longestMatchPath === folder.fullPath,
        isFavoriteFolder: true,
      })
    })
  }

  return links
})

const quickLinks = computed(() => links.value.filter((it) => it.type === 'RECENTS'))
const volumeLinks = computed(() => links.value.filter((it) => it.type !== 'RECENTS' && !it.isFavoriteFolder))
const favoriteLinks = computed(() => links.value.filter((it) => it.isFavoriteFolder))

function percentClass(p?: number) {
  const v = Math.round(p || 0)
  if (v >= 85) return 'warn'
  return ''
}

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
