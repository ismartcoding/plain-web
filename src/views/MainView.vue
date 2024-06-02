<template>
  <div v-if="loading" class="content-loading">
    <md-circular-progress indeterminate />
  </div>
  <div v-else-if="errorMessage" class="alert alert-danger">
    {{ $t(errorMessage) }}
  </div>
  <template v-else>
    <div class="layout">
      <header id="header">
        <section class="start">
          <div class="tab-items">
            <div class="tab-item" @click="selectTab('/')" key="/" :class="{ active: currentPath === '/' }" @contextmenu="itemCtxMenu($event, '/')">
              <span>{{ $t('page_title.home') }}</span>
            </div>
            <div v-for="item of store.pages" :key="item.path" @click="selectTab(item.path)" class="tab-item" @contextmenu="itemCtxMenu($event, item.path)" :class="{ active: currentPath === item.path }">
              <span>{{ $t(`page_title.${getRouteName(item.path)}`) }}</span>
              <button class="btn-icon sm tab-icon" @click.stop="closeTab(item.path)">
                <md-ripple />
                <i-material-symbols:close-rounded />
              </button>
            </div>
          </div>
        </section>
        <section class="end">
          <header-actions :logged-in="true" />
        </section>
      </header>
      <div class="page-content">
        <!-- The cache key $route.meta.group is mainly used for MediaSidebar, otherwise the component will be cached totally. -->
        <router-view name="LeftSidebar" v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" :key="$route.meta.group" />
          </keep-alive>
        </router-view>
        <main class="main" :class="'main-' + ($route.meta.className || 'default')">
          <router-view name="LeftSidebar2" v-slot="{ Component }">
            <keep-alive>
              <component :is="Component" :key="getSidebar2CacheKey()" />
            </keep-alive>
          </router-view>
          <router-view v-slot="{ Component }">
            <keep-alive>
              <component :is="Component" :key="$route.fullPath" />
            </keep-alive>
          </router-view>
        </main>
      </div>
      <div class="quick">
        <button class="btn-icon q-action" v-if="app.channel !== 'GOOGLE'" v-tooltip="$t('header_actions.notifications')" @click="toggleQuick('notification')" toggle :class="{ selected: store.quick === 'notification' }">
          <md-ripple />
          <i-material-symbols:notifications-outline-rounded />
        </button>
        <button v-if="hasTasks" class="btn-icon q-action" v-tooltip="$t('header_actions.tasks')" @click="toggleQuick('task')" toggle :class="{ selected: store.quick === 'task' }">
          <md-ripple />
          <i-material-symbols:format-list-numbered-rounded />
        </button>
        <button id="quick-audio" class="btn-icon q-action" v-tooltip="$t('playlist')" @click="toggleQuick('audio')" toggle :class="{ selected: store.quick === 'audio' }">
          <md-ripple />
          <i-material-symbols:queue-music-rounded />
        </button>
        <button class="btn-icon q-action" v-tooltip="$t('my_phone')" @click="toggleQuick('chat')" toggle :class="{ selected: store.quick === 'chat' }">
          <md-ripple />
          <i-material-symbols:chat-outline-rounded />
        </button>

        <div class="drag-indicator" v-show="store.quick" @mousedown="initResize">
          <i-material-symbols:drag-indicator />
        </div>
      </div>
      <transition name="width">
        <div class="quick-content" v-show="store.quick" :style="{ width: store.quickContentWidth + 'px' }">
          <chat v-show="store.quick === 'chat'" />
          <audio-player v-show="store.quick === 'audio'" />
          <task-list v-show="store.quick === 'task'" />
          <notifications v-show="store.quick === 'notification'" />
        </div>
      </transition>
      <lightbox />
    </div>
  </template>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed, onUnmounted } from 'vue'
import { useMainStore } from '@/stores/main'
import { useRouter, type RouteLocationNormalized } from 'vue-router'
import { getRouteName } from '@/plugins/router'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { appGQL, initQuery } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'
import { tokenToKey } from '@/lib/api/file'
import type { IMediaItemDeletedEvent, IMediaItemsDeletedEvent, IPage } from '@/lib/interfaces'
import { contextmenu } from '@/components/contextmenu'
import { useI18n } from 'vue-i18n'
import { remove } from 'lodash-es'

const store = useMainStore()
const router = useRouter()
const tempStore = useTempStore()
const { app, urlTokenKey } = storeToRefs(tempStore)
const { t } = useI18n()

const loading = ref(true)
const errorMessage = ref('')
let playAudio = false

const hasTasks = computed(() => {
  return tempStore.uploads.length > 0
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
  handle: (data: any, error: string) => {
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
  appApi: true,
})

function initResize(e: MouseEvent) {
  const startX = e.clientX
  const startWidth = store.quickContentWidth
  const appElement = document.getElementById('app')
  if (appElement) {
    appElement.style.userSelect = 'none'
  }
  const move = (e: MouseEvent) => {
    const width = startWidth + startX - e.clientX
    if (width < 300) {
      store.quickContentWidth = 300
      return
    }
    store.quickContentWidth = width
  }
  const up = () => {
    appElement?.style.removeProperty('user-select')
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}

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

const mediaItemsDeletedHandler = (event: IMediaItemsDeletedEvent) => {
  if (event.type === 'AUDIO') {
    refetchApp()
  }
}

const mediaItemDeletedHanlder = (event: IMediaItemDeletedEvent) => {
  if (event.type === 'AUDIO') {
    refetchApp()
  }
}

onMounted(() => {
  emitter.on('refetch_app', refetchAppHandler)
  emitter.on('play_audio', playAudioHandler)
  emitter.on('media_items_deleted', mediaItemsDeletedHandler)
  emitter.on('media_item_deleted', mediaItemDeletedHanlder)
})

onUnmounted(() => {
  emitter.off('refetch_app', refetchAppHandler)
  emitter.off('play_audio', playAudioHandler)
  emitter.off('media_items_deleted', mediaItemsDeletedHandler)
  emitter.off('media_item_deleted', mediaItemDeletedHanlder)
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
    'page-content quick quick-content';
  grid-template-columns: 1fr auto auto;
  grid-template-rows: auto 1fr;
  height: 100vh;
  min-width: var(--screen-min-width);
}

.quick {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  width: 56px;
  grid-area: quick;

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
    margin-inline-start: 16px;
    flex: 1;
    box-sizing: border-box;
    overflow: auto;
    scroll-behavior: smooth;
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
