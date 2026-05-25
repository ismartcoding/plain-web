import { onMounted, ref, watch, computed, onUnmounted } from 'vue'
import { useMainStore } from '@/stores/main'
import { useRouter } from 'vue-router'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { initQuery, appGQL } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'
import { tokenToKey } from '@/lib/api/file'
import type { IApp, IMediaItemsActionedEvent } from '@/lib/interfaces'
import { useRightSidebarResize } from '@/hooks/sidebar'
import { getMainStateKey } from '@/lib/device-current'
import { get as prefsGet, set as prefsSet } from '@/lib/prefs'
import { useDeviceSessionsStore } from '@/stores/device-sessions'
import { isLocalMode } from '@/lib/local-mode'

export function useMainView() {
  const store = useMainStore()
  const router = useRouter()
  const tempStore = useTempStore()
  const sessionsStore = useDeviceSessionsStore()
  const { app, urlTokenKey } = storeToRefs(tempStore)

  const loading = ref(true)
  const errorMessage = ref('')
  let playAudio = false

  // In local mode there is no device to query — suppress the loading state immediately
  // so there is no loading flash, but still run appGQL to get the urlToken from the
  // local server (needed for file URL encryption).
  const localMode = isLocalMode()
  if (localMode) loading.value = false

  const hiddenHeaderSearchRoutes = new Set(['/files/recent', '/screen-mirror'])
  const hiddenHeaderSearchPatterns = [/^\/chat(?:\/|$)/]

  function toggleSidebar() { store.miniSidebar = !store.miniSidebar }

  const hasTasks = computed(() => tempStore.uploads.length > 0)

  const hasActiveUploads = computed(() => {
    return tempStore.uploads.some((u) => ['uploading', 'saving', 'pending'].includes(u.status))
  })

  const hasLeftSidebar = computed(() => {
    const route = router.currentRoute.value
    const matchedRoute = route.matched[route.matched.length - 1]
    return matchedRoute?.components?.LeftSidebar !== undefined
  })

  function getSidebar2CacheKey() {
    const route = router.currentRoute.value
    const matchedPath = route.matched[route.matched.length - 1]?.path ?? ''
    return (route.meta.group ?? '') + matchedPath + (route.query.q ?? '')
  }

  function toggleQuick(name: string) {
    if (localMode && name === 'notification') return
    store.quick = store.quick === name ? '' : name
  }

  const showHeaderSearch = computed(() => {
    const route = router.currentRoute.value
    return !hiddenHeaderSearchRoutes.has(route.path) && !hiddenHeaderSearchPatterns.some((p) => p.test(route.path))
  })

  const refetchApp = initQuery({
    handle: (data: { app: IApp }, error: string) => {
      loading.value = false
      if (error) {
        errorMessage.value = error
      } else if (data) {
        const oldToken = app.value?.urlToken
        const newToken = data.app.urlToken
        urlTokenKey.value = tokenToKey(newToken)
        if (oldToken !== newToken) window.fileIdMap = new Map<string, string>()
        app.value = data.app
        // Keep the session name in sync with the device's reported name.
        if (data.app.deviceName && sessionsStore.currentClientId) {
          sessionsStore.updateName(sessionsStore.currentClientId, data.app.deviceName)
        }
        if (playAudio) { playAudio = false; emitter.emit('do_play_audio') }
      }
    },
    document: appGQL,
  }).refetch

  const { resizeWidth } = useRightSidebarResize(
    300,
    () => store.quickContentWidth,
    (width: number) => { store.quickContentWidth = width },
  )

  const currentPath = ref(router.currentRoute.value.fullPath)
  watch(() => router.currentRoute.value.fullPath, (v: string) => { currentPath.value = v })

  const refetchAppHandler = () => refetchApp()
  const playAudioHandler = () => { playAudio = true; refetchApp() }
  const mediaItemsActionedHandler = (event: IMediaItemsActionedEvent) => {
    if (event.type === 'AUDIO') refetchApp()
  }

  onMounted(() => {
    emitter.on('refetch_app', refetchAppHandler)
    emitter.on('play_audio', playAudioHandler)
    emitter.on('media_items_actioned', mediaItemsActionedHandler)
  })

  onUnmounted(() => {
    emitter.off('refetch_app', refetchAppHandler)
    emitter.off('play_audio', playAudioHandler)
    emitter.off('media_items_actioned', mediaItemsActionedHandler)
  })

  // Restore persisted state from prefs
  const localState = prefsGet<Record<string, unknown> | null>(getMainStateKey(), null)
  if (localState) {
    store.$state = { ...store.$state, ...localState }
  }

  watch(store.$state, (state) => {
    prefsSet(getMainStateKey(), state)
    currentPath.value = router.currentRoute.value.fullPath
  }, { deep: true })

  return {
    store, app, loading, errorMessage,
    hasTasks, hasActiveUploads, hasLeftSidebar, showHeaderSearch, localMode,
    toggleSidebar, toggleQuick, getSidebar2CacheKey, resizeWidth,
  }
}
