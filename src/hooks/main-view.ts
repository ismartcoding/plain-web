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

export function useMainView() {
  const store = useMainStore()
  const router = useRouter()
  const tempStore = useTempStore()
  const { app, urlTokenKey } = storeToRefs(tempStore)

  const loading = ref(true)
  const errorMessage = ref('')
  let playAudio = false

  const hiddenHeaderSearchRoutes = new Set(['/files/recent', '/screen-mirror'])
  const hiddenHeaderSearchPatterns = [/^\/chat(?:\/|$)/]

  function toggleSidebar() { store.miniSidebar = !store.miniSidebar }

  const hasTasks = computed(() => tempStore.uploads.length > 0)

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
    store.quick = store.quick === name ? '' : name
  }

  const showHeaderSearch = computed(() => {
    const route = router.currentRoute.value
    return !hiddenHeaderSearchRoutes.has(route.path) && !hiddenHeaderSearchPatterns.some((p) => p.test(route.path))
  })

  const { refetch: refetchApp } = initQuery({
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
        if (playAudio) { playAudio = false; emitter.emit('do_play_audio') }
      }
    },
    document: appGQL,
  })

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

  // Restore persisted state from localStorage
  const localState = localStorage.getItem('main_state')
  if (localState) {
    const json = JSON.parse(localState)
    store.$state = { ...store.$state, ...json }
  }

  watch(store.$state, (state) => {
    localStorage.setItem('main_state', JSON.stringify(state))
    currentPath.value = router.currentRoute.value.fullPath
  }, { deep: true })

  return {
    store, app, loading, errorMessage,
    hasTasks, hasLeftSidebar, showHeaderSearch,
    toggleSidebar, toggleQuick, getSidebar2CacheKey, resizeWidth,
  }
}
