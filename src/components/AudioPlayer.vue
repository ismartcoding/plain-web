<template>
  <div class="audio-player">
    <div class="play-title" v-if="current">{{ current.title }}</div>
    <audio ref="audioRef" class="audio" controls :src="src" @ended="onEnded" />
    <div class="buttons" v-if="audios.length">
      <button class="icon-button" @click.stop="playPrev">
        <md-ripple />
        <i-material-symbols:skip-previous-outline-rounded />
      </button>
      <button class="icon-button mode" @click.stop="changeMode">
        <md-ripple />
        <i-material-symbols:shuffle-outline-rounded v-if="app?.audioMode === 'SHUFFLE'" />
        <i-material-symbols:repeat-rounded v-else-if="app?.audioMode === 'REPEAT'" />
        <i-material-symbols:repeat-one-rounded v-else />
      </button>
      <button class="icon-button" @click.stop="playNext">
        <md-ripple />
        <i-material-symbols:skip-next-outline-rounded />
      </button>
      <md-circular-progress indeterminate v-if="clearLoading" class="spinner-sm" />
      <button class="icon-button" v-else @click.prevent="clear" v-tooltip="$t('clear_list')">
        <md-ripple />
        <i-material-symbols:delete-forever-outline-rounded />
      </button>
    </div>
    <section class="list-items">
      <div
        v-for="item in audios"
        class="item"
        :key="item.path"
        @click.stop="playItem(item)"
        :class="{ selected: item.path === current?.path }"
      >
        <md-ripple />
        <div class="title">{{ item.title }}</div>
        <div class="subtitle">{{ item.artist }} {{ formatSeconds(item.duration) }}</div>
        <button class="icon-button icon" @click.stop="deleteItem(item)">
          <md-ripple />
          <i-material-symbols:close-rounded />
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import type { IPlaylistAudio } from '@/lib/interfaces'
import { getFileUrlByPath } from '@/lib/api/file'
import { formatSeconds } from '@/lib/format'
import {
  initMutation,
  playAudioGQL,
  updateAudioPlayModeGQL,
  deletePlaylistAudioGQL,
  clearAudioPlaylistGQL,
} from '@/lib/api/mutation'
import { sample, remove } from 'lodash-es'
import emitter from '@/plugins/eventbus'

const { app, urlTokenKey, audioPlaying } = storeToRefs(useTempStore())

const audios = computed<IPlaylistAudio[]>(() => {
  return (app.value as any).audios ?? []
})

const current = ref<IPlaylistAudio | undefined>()
const src = ref('')

async function setCurrent() {
  const { audioCurrent: c } = app.value
  src.value = getFileUrlByPath(urlTokenKey.value, c)
  current.value = audios.value.find((it) => it.path == c)
}

setCurrent()

watch(() => app.value.audioCurrent, setCurrent)

const {
  mutate: play,
  loading: playLoading,
  onDone: playDone,
  onError: playError,
} = initMutation({
  document: playAudioGQL,
  appApi: true,
})

const {
  mutate: clear,
  loading: clearLoading,
  onDone: clearDone,
  onError: clearError,
} = initMutation({
  document: clearAudioPlaylistGQL,
  appApi: true,
})

clearDone(() => {
  app.value = { ...app.value, audioCurrent: '', audios: [] }
})

const {
  mutate: updatePlayMode,
  loading: updatePlayModeLoading,
  onDone: updatePlayModeDone,
  onError: updatePlayModeError,
} = initMutation({
  document: updateAudioPlayModeGQL,
  appApi: true,
})

const {
  mutate: deleteAudio,
  loading: deleteAudioLoading,
  onDone: deleteAudioDone,
  onError: deleteAudioError,
} = initMutation({
  document: deletePlaylistAudioGQL,
  appApi: true,
})

const audioRef = ref<HTMLAudioElement>()

async function onEnded() {
  if (audios.value.length === 0) {
    return
  }

  const mode = app.value.audioMode
  if (mode === 'REPEAT') {
    _playNext()
  } else if (mode === 'REPEAT_ONE') {
    audioRef.value?.play()
  } else {
    playRandom()
  }
}

function playRandom() {
  const c = sample(app.value.audios)
  play({
    path: c.path,
  })

  app.value = { ...app.value, audioCurrent: c.path }
}

function playPrev() {
  if (audios.value.length === 0) {
    return
  }

  if (app.value.audioMode === 'SHUFFLE') {
    playRandom()
  } else {
    _playPrev()
  }
}

function _playPrev() {
  const index = audios.value.findIndex((it) => it.path === current.value?.path)
  let c: IPlaylistAudio
  if (index <= 0) {
    c = audios.value[audios.value.length - 1]
  } else {
    c = audios.value[index - 1]
  }

  play({
    path: c.path,
  })

  app.value = { ...app.value, audioCurrent: c.path }
}

function playNext() {
  if (audios.value.length === 0) {
    return
  }

  if (app.value.audioMode === 'SHUFFLE') {
    playRandom()
  } else {
    _playNext()
  }
}

function _play() {
  audioRef.value?.play()
}

function _playNext() {
  const index = audios.value.findIndex((it) => it.path === current.value?.path)
  let c: IPlaylistAudio
  if (index + 1 >= audios.value.length) {
    c = audios.value[0]
  } else {
    c = audios.value[index + 1]
  }

  play({
    path: c.path,
  })

  app.value = { ...app.value, audioCurrent: c.path }
}

function changeMode() {
  let mode = app.value.audioMode
  if (mode === 'REPEAT') {
    mode = 'REPEAT_ONE'
  } else if (mode === 'REPEAT_ONE') {
    mode = 'SHUFFLE'
  } else {
    mode = 'REPEAT'
  }
  updatePlayMode({ mode })
  app.value = { ...app.value, audioMode: mode }
}

function playItem(item: IPlaylistAudio) {
  play({
    path: item.path,
  })

  app.value = { ...app.value, audioCurrent: item.path }
}

playDone(() => {
  _play()
})

function deleteItem(item: IPlaylistAudio) {
  deleteAudio({
    path: item.path,
  })

  const items = [...app.value.audios]
  remove(items, (it) => it.path === item.path)
  app.value = { ...app.value, audios: items }
}

onMounted(() => {
  emitter.on('do_play_audio', () => {
    setTimeout(_play, 500)
  })

  emitter.on('pause_audio', () => {
    audioRef.value?.pause()
  })

  audioRef.value?.addEventListener('pause', function () {
    audioPlaying.value = false
  })

  audioRef.value?.addEventListener('play', function () {
    audioPlaying.value = true
  })
})
</script>

<style lang="scss" scoped>
.audio-player {
  background-color: var(--md-sys-color-surface);
  overflow-x: hidden;
  overflow-y: auto;
  width: var(--quick-content-width);
  height: 100%;
}

.list-items .item {
  cursor: pointer;
}

.play-title {
  text-align: center;
  padding: 16px;
  white-space: pre-wrap;
  font-size: 0.825rem;
}

.buttons {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 8px;
}

.mode {
  margin: 0px 32px;
}

.audio {
  display: block;
  width: 100%;
}
</style>
