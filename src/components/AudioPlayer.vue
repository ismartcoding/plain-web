<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button v-tooltip="$t('close')" class="btn-icon" @click.prevent="store.quick = ''">
        <md-ripple />
        <i-material-symbols:right-panel-close-outline />
      </button>
      <div class="title">{{ current?.title ?? $t('audio_player') }}</div>
    </div>
    <div class="quick-content-body">
      <audio ref="audioRef" class="audio" controls :src="src" @ended="onEnded" />
      <div v-if="audios.length" class="buttons">
        <button class="btn-icon" @click.stop="playPrev">
          <md-ripple />
          <i-material-symbols:skip-previous-outline-rounded />
        </button>
        <button class="btn-icon mode" @click.stop="changeMode">
          <md-ripple />
          <i-material-symbols:shuffle-outline-rounded v-if="app?.audioMode === 'SHUFFLE'" />
          <i-material-symbols:repeat-rounded v-else-if="app?.audioMode === 'REPEAT'" />
          <i-material-symbols:repeat-one-rounded v-else />
        </button>
        <button class="btn-icon" @click.stop="playNext">
          <md-ripple />
          <i-material-symbols:skip-next-outline-rounded />
        </button>
        <md-circular-progress v-if="clearLoading" indeterminate class="spinner-sm" />
        <button v-else v-tooltip="$t('clear_list')" class="btn-icon" @click.prevent="clear">
          <md-ripple />
          <i-material-symbols:delete-forever-outline-rounded />
        </button>
      </div>
      <section class="list-items">
        <div v-for="item in audios" :key="item.path" class="item" :class="{ selected: item.path === current?.path }" @click.stop="playItem(item)" @mousedown="fixUserSelect">
          <div class="title">{{ item.title }}</div>
          <div class="subtitle">{{ item.artist }} {{ formatSeconds(item.duration) }}</div>
          <button v-tooltip="$t('remove_from_playlist')" class="btn-icon icon" @click.stop="deleteItem(item)">
            <md-ripple />
            <i-material-symbols:playlist-remove class="playlist-remove-icon" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import type { IPlaylistAudio } from '@/lib/interfaces'
import { getFileUrlByPath } from '@/lib/api/file'
import { formatSeconds } from '@/lib/format'
import { initMutation, playAudioGQL, updateAudioPlayModeGQL, deletePlaylistAudioGQL, clearAudioPlaylistGQL } from '@/lib/api/mutation'
import { sample, remove } from 'lodash-es'
import emitter from '@/plugins/eventbus'
import { useMainStore } from '@/stores/main'
import { fixUserSelect } from '@/hooks/text-selection'

const { app, urlTokenKey, audioPlaying } = storeToRefs(useTempStore())
const store = useMainStore()

const audios = computed<IPlaylistAudio[]>(() => {
  return app.value?.audios ?? []
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
})

const {
  mutate: clear,
  loading: clearLoading,
  onDone: clearDone,
  onError: clearError,
} = initMutation({
  document: clearAudioPlaylistGQL,
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
})

const {
  mutate: deleteAudio,
  loading: deleteAudioLoading,
  onDone: deleteAudioDone,
  onError: deleteAudioError,
} = initMutation({
  document: deletePlaylistAudioGQL,
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

.playlist-remove-icon {
  color: var(--md-sys-color-error) !important;
}
</style>
