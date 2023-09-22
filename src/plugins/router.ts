import { createRouter, createWebHistory } from 'vue-router'
import MainView from '../views/MainView.vue'
import { nextTick } from 'vue'

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
          component: () => import('../views/HomeView.vue'),
          meta: { group: 'home' },
        },
        {
          path: 'messages',
          component: () => import('../views/MessagesRootView.vue'),
          meta: { group: 'messages' },
          children: [
            {
              path: '',
              component: () => import('../views/MessagesView.vue'),
              meta: { group: 'messages' },
            },
            {
              path: ':type',
              component: () => import('../views/MessagesView.vue'),
              meta: { group: 'messages' },
            },
          ],
        },
        {
          path: 'calls',
          component: () => import('../views/CallsRootView.vue'),
          meta: { group: 'calls' },
          children: [
            {
              path: '',
              component: () => import('../views/CallsView.vue'),
              meta: { group: 'calls' },
            },
            {
              path: ':type',
              component: () => import('../views/CallsView.vue'),
              meta: { group: 'calls' },
            },
          ],
        },
        {
          path: 'apps',
          component: () => import('../views/AppsRootView.vue'),
          meta: { group: 'apps' },
          children: [
            {
              path: '',
              component: () => import('../views/AppsView.vue'),
              meta: { group: 'apps' },
            },
            {
              path: ':type',
              component: () => import('../views/AppsView.vue'),
              meta: { group: 'apps' },
            },
          ],
        },
        {
          path: 'contacts',
          component: () => import('../views/ContactsRootView.vue'),
          meta: { group: 'contacts' },
          children: [
            {
              path: '',
              component: () => import('../views/ContactsView.vue'),
              meta: { group: 'contacts' },
            },
          ],
        },
        {
          path: 'images',
          component: () => import('../views/ImagesRootView.vue'),
          meta: { group: 'images' },
          children: [
            {
              path: '',
              component: () => import('../views/ImagesView.vue'),
              meta: { group: 'images' },
            },
          ],
        },
        {
          path: 'videos',
          component: () => import('../views/VideosRootView.vue'),
          meta: { group: 'videos' },
          children: [
            {
              path: '',
              component: () => import('../views/VideosView.vue'),
              meta: { group: 'videos' },
            },
          ],
        },
        {
          path: 'audios',
          component: () => import('../views/AudiosRootView.vue'),
          meta: { group: 'audios' },
          children: [
            {
              path: '',
              component: () => import('../views/AudiosView.vue'),
              meta: { group: 'audios' },
            },
          ],
        },
        {
          path: 'notes/:id',
          component: () => import('../views/NoteEditView.vue'),
          meta: { group: 'notes' },
        },
        {
          path: 'notes',
          component: () => import('../views/NotesRootView.vue'),
          meta: { group: 'notes' },
          children: [
            {
              path: '',
              component: () => import('../views/NotesView.vue'),
              meta: { group: 'notes' },
            },
            {
              path: 'trash',
              component: () => import('../views/NotesTrashView.vue'),
              meta: { group: 'trash' },
            },
          ],
        },
        {
          path: 'aichats/:id',
          component: () => import('../views/AIChatView.vue'),
          meta: { group: 'aichats' },
        },
        {
          path: 'aichats',
          component: () => import('../views/AIChatsRootView.vue'),
          meta: { group: 'aichats' },
          children: [
            {
              path: '',
              component: () => import('../views/AIChatsView.vue'),
              meta: { group: 'aichats' },
            },
          ],
        },
        {
          path: 'files',
          component: () => import('../views/FilesRootView.vue'),
          meta: { group: 'files' },
          children: [
            {
              path: '',
              component: () => import('../views/FilesVIew.vue'),
              meta: { group: 'files' },
            },
            {
              path: 'recent',
              component: () => import('../views/FilesRecentVIew.vue'),
              meta: { group: 'files' },
            },
            {
              path: ':type',
              component: () => import('../views/FilesVIew.vue'),
              meta: { group: 'files' },
            },
          ],
        },
        {
          path: 'json-viewer',
          component: () => import('../views/JsonViewerView.vue'),
          meta: { group: 'json_viewer' },
        },
        {
          path: 'qrcode-generator',
          component: () => import('../views/QrCodeGeneratorView.vue'),
          meta: { group: 'qrcode_generator' },
        },
        {
          path: 'screen-mirror',
          component: () => import('../views/ScreenMirrorView.vue'),
          meta: { group: 'screen_mirror' },
        },
        {
          path: 'network',
          component: () => import('../views/NetworkView.vue'),
          meta: { group: 'network' },
        },
        {
          path: 'wifi',
          component: () => import('../views/WiFiView.vue'),
          meta: { group: 'wifi' },
        },
        {
          path: 'wireguard',
          component: () => import('../views/WireGuardView.vue'),
          meta: { group: 'wireguard' },
        },
        {
          path: 'wireguard/:id',
          component: () => import('../views/WireGuardEditView.vue'),
          meta: { group: 'wireguard' },
        },
        {
          path: 'rules',
          component: () => import('../views/RulesView.vue'),
          meta: { group: 'rules' },
        },
        {
          path: 'routes',
          component: () => import('../views/RoutesView.vue'),
          meta: { group: 'routes' },
        },
        {
          path: 'devices',
          component: () => import('../views/DevicesView.vue'),
          meta: { group: 'devices' },
        },
        {
          path: 'feeds',
          component: () => import('../views/FeedsRootView.vue'),
          meta: { group: 'feeds' },
          children: [
            {
              path: '',
              component: () => import('../views/FeedsView.vue'),
              meta: { group: 'feeds' },
            },
            {
              path: ':feedId/entries/:id',
              component: () => import('../views/FeedEntryView.vue'),
              meta: { group: 'feeds' },
            },
          ],
        },
      ],
    },
    {
      name: 'login',
      path: '/login',
      component: () => import('../views/LoginView.vue'),
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
      if (top) {
        a.scrollTop = top
      }
    }
  }, 0)
})

export default router

export const replacePathNoReload = (store: any, fullPath: string) => {
  const oldPath = router.currentRoute.value.fullPath
  router.currentRoute.value.fullPath = fullPath
  if (store.pages.includes(fullPath)) {
    window.history.pushState({}, document.title, fullPath)
  } else {
    window.history.replaceState({}, document.title, fullPath)
    store.replaceRoute(oldPath, fullPath)
  }
}

export const replacePath = (store: any, fullPath: string) => {
  if (store.pages.includes(fullPath)) {
    router.push(fullPath)
  } else {
    router.replace(fullPath)
    store.replaceRoute(router.currentRoute.value.fullPath, fullPath)
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
