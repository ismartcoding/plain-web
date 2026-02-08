import { createRouter, createWebHistory } from 'vue-router'
import MainView from '@/views/MainView.vue'
import type { MainState } from '@/stores/main'

const router = createRouter({
  strict: true,
  history: createWebHistory(),
  scrollBehavior(_to, _from, savedPosition) {
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
          path: 'messages',
          components: {
            default: () => import('@/views/messages/MessagesView.vue'),
            LeftSidebar: () => import('@/views/messages/MessagesSidebar.vue'),
          },
          meta: { group: 'messages' },
        },
        {
          path: 'calls',
          components: {
            default: () => import('@/views/calls/CallsView.vue'),
            LeftSidebar: () => import('@/views/calls/CallsSidebar.vue'),
          },
          meta: { group: 'calls' },
        },
        {
          path: 'apps',
          components: {
            default: () => import('@/views/apps/AppsView.vue'),
            LeftSidebar: () => import('@/views/apps/AppsSidebar.vue'),
          },
          meta: { group: 'apps' },
        },
        {
          path: 'contacts',
          components: {
            default: () => import('@/views/contacts/ContactsView.vue'),
            LeftSidebar: () => import('@/views/contacts/ContactsSidebar.vue'),
          },
          meta: { group: 'contacts' },
        },
        {
          path: 'images',
          components: {
            default: () => import('@/views/images/ImagesView.vue'),
            LeftSidebar: () => import('@/views/images/ImagesSidebar.vue'),
          },
          meta: { group: 'images' },
        },
        {
          path: 'videos',
          components: {
            default: () => import('@/views/videos/VideosView.vue'),
            LeftSidebar: () => import('@/views/videos/VideosSidebar.vue'),
          },
          meta: { group: 'videos' },
        },
        {
          path: 'audios',
          components: {
            default: () => import('@/views/audios/AudiosView.vue'),
            LeftSidebar: () => import('@/views/audios/AudiosSidebar.vue'),
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
            LeftSidebar: () => import('../views/notes/NotesSidebar.vue'),
          },
          meta: { group: 'notes' },
        },
        {
          path: 'files',
          components: {
            default: () => import('@/views/files/FilesView.vue'),
            LeftSidebar: () => import('@/views/files/FilesSidebar.vue'),
          },
          meta: { group: 'files', className: 'files' },
        },
        {
          path: 'files/recent',
          components: {
            default: () => import('@/views/files/FilesRecentView.vue'),
            LeftSidebar: () => import('@/views/files/FilesSidebar.vue'),
          },
          meta: { group: 'files', className: 'files' },
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
    {
      name: 'text-file',
      path: '/text-file',
      component: () => import('@/views/TextFileView.vue'),
      meta: { requiresAuth: false },
    },
    {
      name: 'text-edit',
      path: '/text-edit',
      component: () => import('@/views/TextFileView.vue'),
      meta: { requiresAuth: true },
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

  // clean up tooltip
  clearTimeout(globalThis.showTooltipTimeout)
  setTimeout(() => {
    const tooltips = document.getElementsByClassName('tooltip')
    for (const tooltip of tooltips) {
      document.body.removeChild(tooltip)
    }
  }, 100)
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

export const replacePathNoReload = (store: MainState, fullPath: string) => {
  router.currentRoute.value.fullPath = fullPath
  window.history.replaceState({}, document.title, fullPath)
}

export const replacePath = (store: MainState, fullPath: string) => {
  router.replace(fullPath)
}

export const pushPath = (fullPath: string) => {
  setTimeout(() => {
    router.push(fullPath)
  }, 0) // Fix the bug if the page is initialized first time, click the view link won't redirect to new page, it just open a new tab.
}

export const getRouteName = (fullPath: string) => {
  return router.resolve(fullPath).meta.group
}
