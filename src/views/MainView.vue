<template>
  <div v-if="loading" class="loading">
    <div class="loader"></div>
  </div>
  <div v-else-if="errorMessage" class="alert alert-danger">
    {{ $t(errorMessage) }}
  </div>
  <template v-else>
    <div style="display: flex">
      <div :style="{ width: store.consoleOpen ? 'calc(100vw - 280px)' : '100vw' }">
        <div class="tab-items">
          <div class="left-items">
            <div class="tab-item" :class="{ active: currentPath === '/' }" @click="selectTab('/')">
              <span>{{ $t('page_title.home') }}</span>
            </div>
            <div
              v-for="item of store.pages"
              class="tab-item"
              :key="item"
              :class="{ active: currentPath === item }"
              @click="selectTab(item)"
            >
              <span>{{ $t(`page_title.${getRouteName(item)}`) }}</span>
              <i-material-symbols:close-rounded class="bi remove" @click.stop="closeTab(item)" />
            </div>
          </div>
          <div class="right-actions">
            <header-actions :logged-in="true" />
          </div>
        </div>
        <router-view v-slot="{ Component, route }">
          <keep-alive :include="includes">
            <component :is="wrap(route.fullPath, Component)" :key="$route.fullPath" />
          </keep-alive>
        </router-view>
      </div>
      <home-console v-show="store.consoleOpen" />
    </div>
    <button type="button" class="btn btn-console" @click="() => (store.consoleOpen = true)" v-show="!store.consoleOpen">
      {{ $t('my_phone') }}
    </button>
  </template>
</template>

<script setup lang="ts">
import { h, onMounted, ref, watch, type Component } from 'vue'
import { useMainStore } from '@/stores/main'
import { useRouter, type RouteLocationNormalized } from 'vue-router'
import { getRouteName } from '@/plugins/router'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { appGQL, initQuery } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'

const store = useMainStore()
const router = useRouter()
const { app } = storeToRefs(useTempStore())

const loading = ref(true)
const errorMessage = ref('')
const includes = ref<string[]>([])
const wrapperMap = new Map()

const { refetch: refetchApp } = initQuery({
  handle: (data: any, error: string) => {
    loading.value = false
    if (error) {
      errorMessage.value = error
    } else {
      if (data) {
        app.value = data.app
      }
    }
  },
  document: appGQL,
  appApi: true,
})

const currentPath = ref(router.currentRoute.value.fullPath)
watch(
  () => router.currentRoute.value.fullPath,
  (v: string) => {
    currentPath.value = v
  }
)

onMounted(() => {
  emitter.on('refetch_app', () => {
    refetchApp()
  })
  includes.value = store.pages
})

const wrap = (fullPath: string, component: Component) => {
  let wrapper
  const wrapperName = fullPath
  if (wrapperMap.has(wrapperName)) {
    wrapper = wrapperMap.get(wrapperName)
  } else {
    wrapper = {
      name: wrapperName,
      render() {
        return h('div', component)
      },
    }
    wrapperMap.set(wrapperName, wrapper)
  }
  return h(wrapper)
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
.alert-danger {
  width: 360px;
  margin: 100px auto;
}

.btn-console {
  position: fixed;
  right: 32px;
  bottom: 16px;
}

.tab-items {
  display: flex;
  box-sizing: border-box;
  border-bottom: 1px solid currentColor;
  position: sticky;
  top: 0;
  z-index: 1;
  white-space: nowrap;
  background-color: var(--back-color);
  .left-items {
    overflow-x: auto;
  }
}

.tab-item {
  display: inline-block;
  cursor: pointer;
  box-sizing: border-box;
  user-select: none;
}

.tab-item.active {
  border-bottom: 3px solid currentColor;
  cursor: default;
}

.tab-item span {
  padding: 8px 16px;
  display: inline-block;
}

.tab-item .remove {
  cursor: pointer;
  margin-right: 8px;
}

.right-actions {
  position: sticky;
  margin-left: auto;
  top: 0;
  right: 0;
  padding-left: 32px;
  padding-right: 12px;
  display: flex;
}
</style>
