import { createRouter, createWebHistory } from 'vue-router'
import MainView from '@/views/MainView.vue'
import type { IPage } from '@/lib/interfaces'

const router = createRouter({
  strict: true,
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
  routes: [
    {
      path: '/',
      component: MainView,
      meta: { requiresAuth: true },
      children: [
        {
          name: 'home',
          path: '',
          components: {
            default: () => import('@/views/HomeView.vue'),
          },
          meta: { group: 'home' },
        },
        {
          path: 'messages/:type?',
          components: {
            default: () => import('@/views/MessagesView.vue'),
            LeftSidebar: () => import('../components/MessagesSidebar.vue'),
          },
          meta: { group: 'messages' },
        },
        {
          path: 'calls/:type?',
          components: {
            default: () => import('@/views/CallsView.vue'),
            LeftSidebar: () => import('../components/CallsSidebar.vue'),
          },
          meta: { group: 'calls' },
        },
        {
          path: 'apps/:type?',
          components: {
            default: () => import('@/views/AppsView.vue'),
            LeftSidebar: () => import('../components/AppsSidebar.vue'),
          },
          meta: { group: 'apps' },
        },
        {
          path: 'contacts',
          components: {
            default: () => import('@/views/ContactsView.vue'),
            LeftSidebar: () => import('../components/ContactsSidebar.vue'),
          },
          meta: { group: 'contacts' },
        },
        {
          path: 'images',
          components: {
            default: () => import('@/views/ImagesView.vue'),
            LeftSidebar: () => import('../components/MediaSidebar.vue'),
          },
          meta: { group: 'images' },
        },
        {
          path: 'videos',
          components: {
            default: () => import('@/views/VideosView.vue'),
            LeftSidebar: () => import('../components/MediaSidebar.vue'),
          },
          meta: { group: 'videos' },
        },
        {
          path: 'audios',
          components: {
            default: () => import('@/views/AudiosView.vue'),
            LeftSidebar: () => import('../components/MediaSidebar.vue'),
          },
          meta: { group: 'audios' },
        },
        {
          path: 'notes/:id',
          component: () => import('@/views/notes/NoteEditView.vue'),
          meta: { group: 'notes' },
        },
        {
          path: 'notes',
          components: {
            default: () => import('@/views/notes/NotesView.vue'),
            LeftSidebar: () => import('../components/NotesSidebar.vue'),
          },
          meta: { group: 'notes' },
        },
        {
          path: 'notes/trash',
          components: {
            default: () => import('@/views/notes/NotesTrashView.vue'),
            LeftSidebar: () => import('../components/NotesSidebar.vue'),
          },
          meta: { group: 'notes' },
        },
        {
          path: 'aichats/:id',
          component: () => import('@/views/AIChatView.vue'),
          meta: { group: 'aichats' },
        },
        {
          path: 'aichats',
          components: {
            default: () => import('@/views/AIChatsView.vue'),
            LeftSidebar: () => import('../components/AIChatsSidebar.vue'),
          },
          meta: { group: 'aichats' },
        },
        {
          path: 'files/:type?',
          components: {
            default: () => import('@/views/FilesView.vue'),
            LeftSidebar: () => import('../components/FilesSidebar.vue'),
          },
          meta: { group: 'files' },
        },
        {
          path: 'files/recent',
          components: {
            default: () => import('@/views/FilesRecentView.vue'),
            LeftSidebar: () => import('../components/FilesSidebar.vue'),
          },
          meta: { group: 'files' },
        },
        {
          path: 'json-viewer',
          component: () => import('@/views/JsonViewerView.vue'),
          meta: { group: 'json_viewer' },
        },
        {
          path: 'qrcode-generator',
          component: () => import('@/views/QrCodeGeneratorView.vue'),
          meta: { group: 'qrcode_generator' },
        },
        {
          path: 'screen-mirror',
          component: () => import('@/views/ScreenMirrorView.vue'),
          meta: { group: 'screen_mirror' },
        },
        {
          path: 'device-info',
          component: () => import('@/views/DeviceInfoView.vue'),
          meta: { group: 'device_info' },
        },
        {
          path: 'network',
          component: () => import('@/views/NetworkView.vue'),
          meta: { group: 'network' },
        },
        {
          path: 'wifi',
          component: () => import('@/views/WiFiView.vue'),
          meta: { group: 'wifi' },
        },
        {
          path: 'wireguard',
          component: () => import('@/views/WireGuardView.vue'),
          meta: { group: 'wireguard' },
        },
        {
          path: 'wireguard/:id',
          component: () => import('@/views/WireGuardEditView.vue'),
          meta: { group: 'wireguard' },
        },
        {
          path: 'rules',
          component: () => import('@/views/RulesView.vue'),
          meta: { group: 'rules' },
        },
        {
          path: 'routes',
          component: () => import('@/views/RoutesView.vue'),
          meta: { group: 'routes' },
        },
        {
          path: 'devices',
          component: () => import('@/views/DevicesView.vue'),
          meta: { group: 'devices' },
        },
        {
          path: 'feeds',
          components: {
            LeftSidebar: () => import('@/views/feeds/FeedsSidebar.vue'),
            LeftSidebar2: () => import('@/views/feeds/FeedsSidebar2.vue'),
          },
          meta: { group: 'feeds', className: 'feeds' },
        },
        {
          path: 'feeds/:feedId/entries/:id',
          components: {
            default: () => import('@/views/feeds/FeedEntryView.vue'),
            LeftSidebar: () => import('@/views/feeds/FeedsSidebar.vue'),
            LeftSidebar2: () => import('@/views/feeds/FeedsSidebar2.vue'),
          },
          meta: { group: 'feeds', className: 'feed-entry' },
        },
      ],
    },
    {
      name: 'login',
      path: '/login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
  ],
})

const scrollTops = new Map<string, number>()
router.beforeEach(async (to, from) => {
  const scrollTop = document.getElementsByClassName('main')[0]?.scrollTop
  if (scrollTop !== undefined) {
    scrollTops.set(from.fullPath, scrollTop)
  }
  const canAccess = localStorage.getItem('auth_token')
  if (to.meta.requiresAuth && !canAccess) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }
})

router.afterEach((to, from) => {
  setTimeout(() => {
    const a = document.getElementsByClassName('main')[0]
    if (a) {
      const top = scrollTops.get(to.fullPath)
      a.scrollTop = top || 0
    }
  }, 0)
})

export default router

export const replacePathNoReload = (store: any, fullPath: string) => {
  const oldPath = router.currentRoute.value.fullPath
  router.currentRoute.value.fullPath = fullPath
  const index = store.pages.findIndex((it: IPage) => it.path === fullPath)
  if (index !== -1) {
    window.history.pushState({}, document.title, fullPath)
  } else {
    window.history.replaceState({}, document.title, fullPath)
    store.replaceRoute(oldPath, fullPath)
  }
}

export const replacePath = (store: any, fullPath: string) => {
  const index = store.pages.findIndex((it: IPage) => it.path === fullPath)
  if (index !== -1) {
    router.push(fullPath)
  } else {
    const oldPath = router.currentRoute.value.fullPath
    router.replace(fullPath)
    store.replaceRoute(oldPath, fullPath)
  }
}

export const pushPath = (fullPath: string) => {
  setTimeout(() => {
    router.push(fullPath)
  }, 0) // Fix the bug if the page is initialized first time, click the view link won't redirect to new page, it just open a new tab.
}

export const getRouteName = (fullPath: string) => {
  return router.resolve(fullPath).meta.group
}
