<template>
  <div class="audio-player">
    <audio ref="audio" class="audio" controls :src="src" @ended="onEnded" />
    <div class="title" v-if="current">{{ current.title }}</div>
    <div class="buttons" v-if="audios.length">
      <i-material-symbols:skip-previous-outline-rounded class="bi bi-btn" @click.stop="playPrev" />
      <div class="mode" @click.stop="changeMode">
        <i-material-symbols:shuffle-outline-rounded v-if="app?.audioMode === 'SHUFFLE'" class="bi bi-btn" />
        <i-material-symbols:repeat-rounded v-else-if="app?.audioMode === 'REPEAT'" class="bi bi-btn" />
        <i-material-symbols:repeat-one-rounded v-else class="bi bi-btn" />
      </div>
      <i-material-symbols:skip-next-outline-rounded class="bi bi-btn" @click.stop="playNext" />
      <button class="btn btn-sm" @click.prevent="clear" :disabled="clearLoading">
        <i class="spinner" v-if="clearLoading"></i>{{ $t('clear_list') }}
      </button>
    </div>
    <div class="list-items">
      <div class="row1" v-for="item in audios" :key="item.path">
        <span class="key">{{ item.title }}</span>
        <span class="value">
          <i-material-symbols:play-arrow-outline-rounded
            class="bi bi-btn"
            v-if="item.path !== current?.path"
            @click.stop="playItem(item)"
          />
          <i-material-symbols:close-rounded class="bi bi-btn" @click.stop="deleteItem(item)" />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import type { IPlaylistAudio } from '@/lib/interfaces'
import { getFileUrlByPath } from '@/lib/api/file'
import {
  initMutation,
  playAudioGQL,
  updateAudioPlayModeGQL,
  deletePlaylistAudioGQL,
  clearAudioPlaylistGQL,
} from '@/lib/api/mutation'
import { sample, remove } from 'lodash-es'
import emitter from '@/plugins/eventbus'

const { app } = storeToRefs(useTempStore())

const audios = computed<IPlaylistAudio[]>(() => {
  return (app.value as any).audios ?? []
})

const current = ref<IPlaylistAudio | undefined>()
const src = ref('')

async function setCurrent() {
  const { fileIdToken, audioCurrent: c } = app.value
  src.value = await getFileUrlByPath(fileIdToken, c)
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

const audio = ref<HTMLAudioElement>()

async function onEnded() {
  if (audios.value.length === 0) {
    return
  }

  const mode = app.value.audioMode
  if (mode === 'REPEAT') {
    _playNext()
  } else if (mode === 'REPEAT_ONE') {
    audio.value?.play()
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
  audio.value?.play()
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
  emitter.on('play_audio', () => {
    setTimeout(_play, 500)
  })
})
</script>

<style lang="scss" scoped>
.audio-player {
  .title {
    text-align: center;
    padding: 0px 8px;
    white-space: pre-wrap;
    font-size: 0.825rem;
  }

  .buttons {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding-bottom: 8px;
  }

  .mode {
    margin: 0px 32px;
  }

  .audio {
    display: block;
    margin: 8px auto;
    width: calc(100% - 16px);
  }
}
</style>
