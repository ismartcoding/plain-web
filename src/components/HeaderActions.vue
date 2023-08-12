<template>
  <div v-click-away="() => (audioMenuVisible = false)" v-if="props.loggedIn" class="h-action">
    <a @click.prevent="() => (audioMenuVisible = !audioMenuVisible)" href="#"
      :title="t('header_actions.audios')"><i-material-symbols:queue-music-rounded class="bi" />
    </a>
    <div class="dropdown-menu header-actions-panel" v-show="audioMenuVisible">
      <audio-player ref="audioPlayer" />
    </div>
  </div>
  <div v-click-away="() => (taskMenuVisible = false)" v-if="props.loggedIn && visibleTasks.length" class="h-action">
    <a @click.prevent="() => (taskMenuVisible = !taskMenuVisible)" href="#" :class="{ 'has-badge': hasTaskBadge }"
      :title="t('header_actions.tasks')"><i-material-symbols:format-list-numbered-rounded class="bi" />
    </a>
    <div class="dropdown-menu header-actions-panel" :class="{ 'no-data': !visibleTasks.length }" v-show="taskMenuVisible">
      <div class="list-items">
        <div class="row1" v-for="item in visibleTasks">
          <span class="key">[{{ $t(`upload_status.${item.status}`) }}] {{ item.file.name }} ({{
            formatFileSize(item.uploadedSize) }} /
            {{ formatFileSize(item.file.size) }})</span>
          <span class="value">
            <i-material-symbols:close-rounded class="bi" @click.prevent="deleteTask(item)" />
          </span>
          <div class="error" v-if="item.error">{{ item.error }}</div>
        </div>
      </div>
      <span v-if="!visibleTasks.length">{{ $t('no_task') }}</span>
    </div>
  </div>
  <div v-click-away="() => (langMenuVisible = false)" class="h-action">
    <a @click.prevent="() => (langMenuVisible = !langMenuVisible)" href="#"
      :title="t('header_actions.language')"><i-material-symbols:translate-rounded class="bi" /></a>
    <ul class="dropdown-menu" v-show="langMenuVisible">
      <li class="dropdown-item" @click="changeLang('en-US')">English</li>
      <li class="dropdown-item" @click="changeLang('zh-CN')">简体中文</li>
      <li class="dropdown-item" @click="changeLang('es')">español</li>
      <li class="dropdown-item" @click="changeLang('ja')">日本語</li>
      <li class="dropdown-item" @click="changeLang('nl')">Nederlands</li>
      <li class="dropdown-item" @click="changeLang('it')">italiano</li>
      <li class="dropdown-item" @click="changeLang('hi')">हिन्दी</li>
      <li class="dropdown-item" @click="changeLang('fr')">français.</li>
      <li class="dropdown-item" @click="changeLang('ru')">русский язык</li>
      <li class="dropdown-item" @click="changeLang('bn')">বাংলা</li>
      <li class="dropdown-item" @click="changeLang('de')">Deutsch</li>
      <li class="dropdown-item" @click="changeLang('pt')">Português</li>
    </ul>
  </div>

  <button class="h-action toggle-dark" @click="toggleDark" :title="t('header_actions.theme')">
    <i-material-symbols:sunny-outline-rounded class="bi light" />
    <i-material-symbols:nightlight class="bi dark" />
  </button>

  <button class="h-action logout" @click="logout" v-if="props.loggedIn" :title="t('header_actions.logout')">
    <i-material-symbols:logout-rounded class="bi" />
  </button>
</template>

<script setup lang="ts">
import { upload } from '@/lib/api/file'
import { useTempStore, type IUploadItem } from '@/stores/temp'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatFileSize } from '@/lib/format'
import emitter from '@/plugins/eventbus'
import { chunk } from 'lodash-es'

const props = defineProps({
  loggedIn: { type: Boolean },
})

const audioMenuVisible = ref(false)
const langMenuVisible = ref(false)
const taskMenuVisible = ref(false)
const { locale, t } = useI18n()
const tempState = useTempStore()

const visibleTasks = computed(() => {
  return tempState.uploads.filter((it) => it.status !== 'done')
})

const hasTaskBadge = computed(() => {
  return visibleTasks.value.length && visibleTasks.value.some((it) => it.status !== 'done')
})

function deleteTask(item: IUploadItem) {
  tempState.uploads.splice(tempState.uploads.indexOf(item), 1)
  if (item.status === 'pending') {
    item.xhr?.abort()
  }
}

function changeLang(loc: string) {
  langMenuVisible.value = false
  locale.value = loc
  localStorage.setItem('locale', loc)
  document.title = t('app_name')
}

function toggleDark() {
  const cls = document.documentElement.classList
  cls.toggle('dark')
  const dark = cls.contains('dark')
  localStorage.setItem('dark', String(dark))
  tempState.dark = dark
}

function logout() {
  localStorage.clear()
  window.location.reload()
}

watch(
  () => tempState.uploads,
  async (uploads) => {
    taskMenuVisible.value = true
    const chunked = chunk(uploads.filter((it) => it.status === 'created'), 10)
    for (const it of chunked) {
      // batch execute 10 uploads
      await Promise.all(it.map(async (item) => {
        item.status = 'pending'
        await upload(item)
        emitter.emit('upload_task_done', item)
      }))
    }
  }
)
</script>

<style lang="scss" scoped>
.h-action {
  border: none;
  outline: none;
  position: relative;
  background-color: transparent;
  padding: 0 8px;
  align-items: center;
  display: flex;
}

.toggle-dark .dark,
.dark .toggle-dark .light {
  display: none;
}

.dark .toggle-dark .dark {
  display: inline-block;
}

.has-badge {
  position: relative;

  &::before {
    content: '';
    position: absolute;
    border-radius: 10px;
    width: 10px;
    height: 10px;
    background-color: var(--red-color);
    top: 1px;
    right: -4px;
  }
}
</style>
