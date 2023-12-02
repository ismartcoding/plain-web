<template>
  <div v-if="loading" class="loading">
    <md-circular-progress indeterminate />
  </div>
  <div v-else-if="errorMessage" class="alert alert-danger">
    {{ $t(errorMessage) }}
  </div>
  <template v-else>
    <div class="layout">
      <header>
        <div class="default-content">
          <section class="start">
            <div class="tab-items">
              <div
                class="tab-item"
                @click="selectTab('/')"
                key="/"
                :class="{ active: currentPath === '/' }"
                @contextmenu="itemCtxMenu($event, '/')"
              >
                <span>{{ $t('page_title.home') }}</span>
              </div>
              <div
                v-for="item of store.pages"
                :key="item"
                @click="selectTab(item)"
                class="tab-item"
                @contextmenu="itemCtxMenu($event, item)"
                :class="{ active: currentPath === item }"
              >
                <span>{{ $t(`page_title.${getRouteName(item)}`) }}</span>
                <button class="icon-button tab-icon" @click.stop="closeTab(item)">
                  <md-ripple />
                  <i-material-symbols:close-rounded />
                </button>
              </div>
            </div>
          </section>
          <section class="end">
            <header-actions :logged-in="true" />
          </section>
        </div>
      </header>
      <div class="page-content">
        <router-view v-slot="{ Component, route }">
          <component :is="wrap(route.fullPath, Component)" :key="$route.fullPath" />
        </router-view>
      </div>
      <div class="quick">
        <button
          class="icon-button q-action"
          v-tooltip="$t('header_actions.notifications')"
          @click="toggleQuick('notification')"
          toggle
          :class="{ selected: store.quick === 'notification' }"
        >
          <md-ripple />
          <i-material-symbols:notifications-outline-rounded />
        </button>
        <button
          v-if="hasTasks"
          class="icon-button q-action"
          v-tooltip="$t('header_actions.tasks')"
          @click="toggleQuick('task')"
          toggle
          :class="{ selected: store.quick === 'task' }"
        >
          <md-ripple />
          <i-material-symbols:format-list-numbered-rounded />
        </button>
        <button
          id="quick-audio"
          class="icon-button q-action"
          v-tooltip="$t('playlist')"
          @click="toggleQuick('audio')"
          toggle
          :class="{ selected: store.quick === 'audio' }"
        >
          <md-ripple />
          <i-material-symbols:queue-music-rounded />
        </button>
        <button
          class="icon-button q-action"
          v-tooltip="$t('my_phone')"
          @click="toggleQuick('chat')"
          toggle
          :class="{ selected: store.quick === 'chat' }"
        >
          <md-ripple />
          <i-material-symbols:chat-outline-rounded />
        </button>
      </div>
      <div class="quick-content">
        <home-console v-show="store.quick === 'chat'" />
        <audio-player v-show="store.quick === 'audio'" />
        <task-list v-show="store.quick === 'task'" />
        <notifications v-show="store.quick === 'notification'" />
      </div>
      <lightbox />
    </div>
  </template>
</template>

<script setup lang="ts">
import { h, onMounted, ref, watch, type Component, computed, onUnmounted } from 'vue'
import { useMainStore } from '@/stores/main'
import { useRouter, type RouteLocationNormalized } from 'vue-router'
import { getRouteName } from '@/plugins/router'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { appGQL, initQuery } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'
import { tokenToKey } from '@/lib/api/file'
import type { IMediaItemDeletedEvent, IMediaItemsDeletedEvent } from '@/lib/interfaces'
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
const includes = ref<string[]>([])
const wrapperMap = new Map()
let playAudio = false

const hasTasks = computed(() => {
  return tempStore.uploads.length > 0
})

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
      remove(store.pages, (it: string) => it !== path)
      if (currentPath.value !== path && currentPath.value !== '/') {
        selectTab(path)
      }
      includes.value = store.pages
    },
  })
  items.push({
    label: t('close_tabs_to_the_right'),
    onClick: () => {
      const index = store.pages.indexOf(path)
      remove(store.pages, (it: string) => store.pages.indexOf(it) > index)
      if (currentPath.value !== path && currentPath.value !== '/') {
        selectTab(path)
      }
      includes.value = store.pages
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
  includes.value = store.pages
})

onUnmounted(() => {
  emitter.off('refetch_app', refetchAppHandler)
  emitter.off('play_audio', playAudioHandler)
  emitter.off('media_items_deleted', mediaItemsDeletedHandler)
  emitter.off('media_item_deleted', mediaItemDeletedHanlder)
})

const wrap = (fullPath: string, component: Component) => {
  let wrapper
  const wrapperName = fullPath
  if (wrapperMap.has(wrapperName)) {
    wrapper = wrapperMap.get(wrapperName)
  } else {
    wrapper = component
    wrapperMap.set(wrapperName, wrapper)
  }
  return wrapper
}

function selectTab(fullPath: string) {
  router.push(fullPath)
}

function closeTab(fullPath: string) {
  const index = store.pages.indexOf(fullPath)
  if (index !== -1) {
    store.pages.splice(index, 1)
    if (currentPath.value === fullPath) {
      if (!store.pages.length) {
        selectTab('/')
      } else if (index < store.pages.length) {
        selectTab(store.pages[index])
      } else if (index - 1 < store.pages.length) {
        selectTab(store.pages[index - 1])
      }
    }
    includes.value = store.pages
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
  store.$state = { ...store.$state, ...JSON.parse(localState) }
}

const ensurePages = (to: RouteLocationNormalized) => {
  if (!['/', '/login'].includes(to.path)) {
    if (!store.pages.includes(to.fullPath)) {
      store.pages.push(to.fullPath)
      includes.value = store.pages
    }
  }
}

ensurePages(router.currentRoute.value)
router.afterEach((to, from, failure) => {
  ensurePages(to)
})
</script>

<style lang="scss" scoped>
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
}

.quick-content {
  grid-area: quick-content;
  overflow: hidden;
}

header {
  height: var(--plain-top-app-bar-height);
  grid-area: head;
  inset: 0 0 auto 0;
  display: flex;
  box-sizing: border-box;
  color: var(--md-sys-color-on-surface);
}

.tab-items {
  display: flex;
  white-space: nowrap;

  .icon-button {
    svg {
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

.default-content {
  width: 100%;
  display: flex;
  align-items: center;

  .start {
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

.page-content {
  grid-area: page-content;
  height: calc(100vh - 64px);
}

.alert-danger {
  width: 360px;
  margin: 100px auto;
  text-align: center;
}
</style>
