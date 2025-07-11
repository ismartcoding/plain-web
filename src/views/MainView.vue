<template>
  <div v-if="loading" class="content-loading">
    <v-circular-progress indeterminate />
  </div>
  <div v-else-if="errorMessage" class="alert alert-danger">
    {{ $t(errorMessage) }}
  </div>
  <template v-else>
    <div class="layout">
      <header id="header">
        <section class="start">
          <v-icon-button 
            v-if="hasLeftSidebar"
            v-tooltip="$t(store.miniSidebar ? 'open' : 'close')" 
            class="sidebar-toggle" 
            @click.prevent="toggleSidebar"
          >
            <i-material-symbols:left-panel-open-outline-rounded v-if="store.miniSidebar" />
            <i-material-symbols:left-panel-close-outline-rounded v-else />
          </v-icon-button>
          <div class="tab-items">
            <div key="/" class="tab-item" :class="{ active: currentPath === '/' }" @click="selectTab('/')" @contextmenu="itemCtxMenu($event, '/')">
              <span>{{ $t('page_title.home') }}</span>
            </div>
            <div
              v-for="item of store.pages"
              :key="item.path"
              class="tab-item"
              :class="{ active: currentPath === item.path }"
              @click="selectTab(item.path)"
              @contextmenu="itemCtxMenu($event, item.path)"
            >
              <span>{{ $t(`page_title.${getRouteName(item.path)}`) }}</span>
              <v-icon-button class="tab-icon" @click.stop="closeTab(item.path)">
                <i-material-symbols:close-rounded />
              </v-icon-button>
            </div>
          </div>
        </section>
        <section class="end">
          <header-actions :logged-in="true" @toggle-quick="toggleQuick" />
        </section>
      </header>
      <div class="page-content">
        <!-- The cache key $route.meta.group is mainly used for MediaSidebar, otherwise the component will be cached totally. -->
        <router-view v-slot="{ Component }" name="LeftSidebar">
          <keep-alive>
            <component :is="Component" :key="$route.meta.group" />
          </keep-alive>
        </router-view>
        <!-- Mobile sidebar backdrop -->
        <div 
          v-if="hasLeftSidebar" 
          class="sidebar-backdrop" 
          :class="{ visible: !store.miniSidebar && isTablet }"
          @click="store.miniSidebar = true"
        ></div>
        <main class="main" :class="'main-' + ($route.meta.className || 'default')">
          <router-view v-slot="{ Component }" name="LeftSidebar2">
            <keep-alive>
              <component :is="Component" :key="getSidebar2CacheKey()" />
            </keep-alive>
          </router-view>
          <router-view v-slot="{ Component }">
            <keep-alive exclude="NoteEditView">
              <component :is="Component" :key="$route.fullPath" />
            </keep-alive>
          </router-view>
        </main>
      </div>
      <div class="quick-actions">
        <v-icon-button
          v-if="hasTasks || store.quick === 'task'"
          v-tooltip="$t('header_actions.tasks')"
          class="q-action"
          toggle
          :class="{ selected: store.quick === 'task' }"
          @click="toggleQuick('task')"
        >
          <i-material-symbols:format-list-numbered-rounded />
        </v-icon-button>
        <v-icon-button
          v-if="app.channel !== 'GOOGLE'"
          v-tooltip="$t('header_actions.notifications')"
          class="q-action"
          toggle
          :class="{ selected: store.quick === 'notification' }"
          @click="toggleQuick('notification')"
        >
          <i-material-symbols:notifications-outline-rounded />
        </v-icon-button>
        <v-icon-button id="quick-audio" v-tooltip="$t('playlist')" class="q-action" toggle :class="{ selected: store.quick === 'audio' }" @click="toggleQuick('audio')">
          <i-material-symbols:queue-music-rounded />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('pomodoro_timer')" class="q-action" toggle :class="{ selected: store.quick === 'pomodoro' }" @click="toggleQuick('pomodoro')">
          <i-material-symbols:timer-outline />
        </v-icon-button>
        <v-icon-button v-tooltip="$t('my_phone')" class="q-action" toggle :class="{ selected: store.quick === 'chat' }" @click="toggleQuick('chat')">
          <i-lucide-bot />
        </v-icon-button>
        <div v-show="store.quick" class="drag-indicator" @mousedown="resizeWidth">
          <i-material-symbols:drag-indicator />
        </div>
      </div>
      <transition name="width">
        <div v-show="store.quick" class="quick-content" :style="{ width: store.quickContentWidth + 'px' }">
          <task-list v-show="store.quick === 'task'" />
          <p-chat v-show="store.quick === 'chat'" />
          <audio-player v-show="store.quick === 'audio'" />
          <p-notifications v-show="store.quick === 'notification'" />
          <pomodoro-timer v-show="store.quick === 'pomodoro'" />
        </div>
      </transition>
      <lightbox />
    </div>
  </template>
</template>

<script setup lang="ts">
import { onMounted, inject, ref, watch, computed, onUnmounted } from 'vue'
import { useMainStore } from '@/stores/main'
import { useRouter, type RouteLocationNormalized } from 'vue-router'
import { getRouteName } from '@/plugins/router'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { appGQL, initQuery } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'
import { tokenToKey } from '@/lib/api/file'
import type { IApp, IMediaItemsActionedEvent, IPage } from '@/lib/interfaces'
import { contextmenu } from '@/components/contextmenu'
import { useI18n } from 'vue-i18n'
import { remove } from 'lodash-es'
import { useRightSidebarResize } from '@/hooks/sidebar'

const isTablet = inject('isTablet')
const store = useMainStore()
const router = useRouter()
const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const { t } = useI18n()

const loading = ref(true)
const errorMessage = ref('')
let playAudio = false

// Sidebar collapse functionality
function toggleSidebar() {
  store.miniSidebar = !store.miniSidebar
}

const hasTasks = computed(() => {
  return tempStore.uploads.length > 0
})

// Check if current route has LeftSidebar component
const hasLeftSidebar = computed(() => {
  const route = router.currentRoute.value
  const matchedRoute = route.matched[route.matched.length - 1]
  return matchedRoute?.components?.LeftSidebar !== undefined
})

function getSidebar2CacheKey() {
  const route = router.currentRoute.value
  return (route.meta.group ?? '') + (route.query.q ?? '')
}

function toggleQuick(name: string) {
  if (store.quick === name) {
    store.quick = ''
  } else {
    store.quick = name
  }
}

const { refetch: refetchApp } = initQuery({
  handle: (data: { app: IApp }, error: string) => {
    loading.value = false
    if (error) {
      errorMessage.value = error
    } else {
      if (data) {
        const oldToken = app.value?.urlToken
        const newToken = data.app.urlToken
        urlTokenKey.value = tokenToKey(newToken)
        if (oldToken !== newToken) {
          // URL token is changed from app, need to reset the fileIdMap
          window.fileIdMap = new Map<string, string>()
        }
        app.value = data.app
        if (playAudio) {
          playAudio = false
          emitter.emit('do_play_audio')
        }
      }
    }
  },
  document: appGQL,
})

const { resizeWidth } = useRightSidebarResize(
  300,
  () => {
    return store.quickContentWidth
  },
  (width: number) => {
    store.quickContentWidth = width
  }
)

function itemCtxMenu(e: MouseEvent, path: string) {
  e.preventDefault()
  const items = []
  if (path !== '/') {
    items.push({
      label: t('close'),
      onClick: () => {
        closeTab(path)
      },
    })
  }
  items.push({
    label: t('close_other_tabs'),
    onClick: () => {
      remove(store.pages, (it: IPage) => it.path !== path)
      if (currentPath.value !== path && currentPath.value !== '/') {
        selectTab(path)
      }
    },
  })
  items.push({
    label: t('close_tabs_to_the_right'),
    onClick: () => {
      const index = store.pages.findIndex((it: IPage) => it.path === path)
      remove(store.pages, (it: IPage) => store.pages.indexOf(it) > index)
      if (currentPath.value !== path && currentPath.value !== '/') {
        selectTab(path)
      }
    },
  })
  contextmenu({
    x: e.x,
    y: e.y,
    items,
  })
}

const currentPath = ref(router.currentRoute.value.fullPath)

watch(
  () => router.currentRoute.value.fullPath,
  (v: string) => {
    currentPath.value = v
  }
)

const refetchAppHandler = () => {
  refetchApp()
}

const playAudioHandler = () => {
  playAudio = true
  refetchApp()
}

const mediaItemsActionedHandler = (event: IMediaItemsActionedEvent) => {
  if (event.type === 'AUDIO') {
    refetchApp()
  }
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

function selectTab(fullPath: string) {
  router.push(fullPath)
}

function closeTab(fullPath: string) {
  const index = store.pages.findIndex((it: IPage) => it.path === fullPath)
  if (index !== -1) {
    store.pages.splice(index, 1)
    if (currentPath.value === fullPath) {
      if (!store.pages.length) {
        selectTab('/')
      } else if (index < store.pages.length) {
        selectTab(store.pages[index].path)
      } else if (index - 1 < store.pages.length) {
        selectTab(store.pages[index - 1].path)
      }
    }
  }
}

watch(
  store.$state,
  (state) => {
    localStorage.setItem('main_state', JSON.stringify(state))
    currentPath.value = router.currentRoute.value.fullPath
  },
  { deep: true }
)

const localState = localStorage.getItem('main_state')
if (localState) {
  const json = JSON.parse(localState)
  // TODO: remove this after 2025.06.01
  if (json.pages) {
    const newPages: IPage[] = []
    json.pages.forEach((it: IPage | string) => {
      if (typeof it === 'string') {
        newPages.push({ path: it })
      } else {
        newPages.push(it)
      }
    })
    json.pages = newPages
  }
  store.$state = { ...store.$state, ...json }
}

const ensurePages = (to: RouteLocationNormalized) => {
  if (!['/', '/login'].includes(to.path)) {
    if (!store.pages.some((it: IPage) => it.path === to.fullPath)) {
      store.pages.push({ path: to.fullPath })
    }
  }
}

ensurePages(router.currentRoute.value)
router.afterEach((to, from, failure) => {
  ensurePages(to)
})
</script>

<style lang="scss" scoped>
.content-loading {
  height: 100vh;
}
.layout {
  display: grid;
  grid-template-areas:
    'head head quick-content'
    'page-content quick-actions quick-content';
  grid-template-columns: 1fr auto auto;
  grid-template-rows: auto 1fr;
  height: 100vh;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  width: 56px;
  grid-area: quick-actions;

  .q-action {
    margin: 8px;
  }

  .drag-indicator {
    align-self: center;
    margin-top: auto;
    margin-bottom: auto;
    cursor: col-resize;
  }
}

.quick-content {
  grid-area: quick-content;
  overflow: hidden;
}

.tab-items {
  display: flex;
  white-space: nowrap;

  .btn-icon {
    *:is(svg) {
      width: 12px;
      height: 12px;
    }
  }
}

.tab-item {
  outline: none;
  cursor: pointer;
  box-sizing: border-box;
  user-select: none;
  text-align: center;
  border-bottom: 3px solid transparent;

  &.active {
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-primary);
  }

  &:first-child span {
    padding-inline-end: 16px;
  }

  span {
    padding: 8px 8px 8px 16px;
    display: inline-block;
  }

  .tab-icon {
    margin-inline: 8px;
    width: 32px;
    height: 32px;
  }
}

#header {
  align-items: center;
  height: var(--pl-top-app-bar-height);
  grid-area: head;
  inset: 0 0 auto 0;
  display: flex;
  box-sizing: border-box;
  color: var(--md-sys-color-on-surface);

  .start {
    margin-inline-start: 8px;
    flex: 1;
    box-sizing: border-box;
    overflow: auto;
    scroll-behavior: smooth;
    display: flex;
    align-items: center;
    /* Hide the scrollbars */
    scrollbar-width: none;
    /* Firefox */
    -ms-overflow-style: none;

    /* Internet Explorer/Edge */
    &::-webkit-scrollbar {
      display: none;
      /* Chrome/Safari/Opera */
    }
  }

  .end {
    margin-left: auto;
    display: flex;
  }
}

.alert-danger {
  width: 360px;
  margin: 100px auto;
  text-align: center;
}
</style>
