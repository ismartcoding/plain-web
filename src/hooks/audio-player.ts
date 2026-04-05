import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import type { IPlaylistAudio } from '@/lib/interfaces'
import { getFileUrlByPath } from '@/lib/api/file'
import { initMutation, playAudioGQL, updateAudioPlayModeGQL, deletePlaylistAudioGQL, clearAudioPlaylistGQL, reorderPlaylistAudiosGQL } from '@/lib/api/mutation'
import { sample, arrayRemove } from '@/lib/array'
import emitter from '@/plugins/eventbus'

export function useAudioPlaylist(audioRef: Ref<HTMLAudioElement | undefined>) {
  const { app, urlTokenKey, audioPlaying } = storeToRefs(useTempStore())

  const audios = computed<IPlaylistAudio[]>(() => app.value?.audios ?? [])
  const playlistAudios = computed<IPlaylistAudio[]>({
    get: () => audios.value,
    set: (value) => { app.value = { ...app.value, audios: value } },
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

  // Mutations
  const { mutate: play, onDone: playDone } = initMutation({ document: playAudioGQL })
  const { mutate: clear, loading: clearLoading } = initMutation({ document: clearAudioPlaylistGQL })
  const { mutate: updatePlayMode } = initMutation({ document: updateAudioPlayModeGQL })
  const { mutate: reorderPlaylistAudios } = initMutation({ document: reorderPlaylistAudiosGQL })
  const { mutate: deleteAudio } = initMutation({ document: deletePlaylistAudioGQL })

  // Clear handler
  const clearDone = () => {
    app.value = { ...app.value, audioCurrent: '', audios: [] }
  }

  function _play() { audioRef.value?.play() }

  playDone(() => _play())

  // Navigation
  function playRandom() {
    const c = sample(app.value.audios)
    if (!c) return
    play({ path: c.path })
    app.value = { ...app.value, audioCurrent: c.path }
  }

  function _playPrev() {
    const index = audios.value.findIndex((it) => it.path === current.value?.path)
    const c = index <= 0 ? audios.value[audios.value.length - 1] : audios.value[index - 1]
    play({ path: c.path })
    app.value = { ...app.value, audioCurrent: c.path }
  }

  function _playNext() {
    const index = audios.value.findIndex((it) => it.path === current.value?.path)
    const c = index + 1 >= audios.value.length ? audios.value[0] : audios.value[index + 1]
    play({ path: c.path })
    app.value = { ...app.value, audioCurrent: c.path }
  }

  function playPrev() {
    if (!audios.value.length) return
    app.value.audioMode === 'SHUFFLE' ? playRandom() : _playPrev()
  }

  function playNext() {
    if (!audios.value.length) return
    app.value.audioMode === 'SHUFFLE' ? playRandom() : _playNext()
  }

  function onEnded() {
    if (!audios.value.length) return
    const mode = app.value.audioMode
    if (mode === 'REPEAT') _playNext()
    else if (mode === 'REPEAT_ONE') audioRef.value?.play()
    else playRandom()
  }

  function changeMode() {
    const modeOrder = { REPEAT: 'REPEAT_ONE', REPEAT_ONE: 'SHUFFLE', SHUFFLE: 'REPEAT' } as const
    const mode = modeOrder[app.value.audioMode as keyof typeof modeOrder] || 'REPEAT'
    updatePlayMode({ mode })
    app.value = { ...app.value, audioMode: mode }
  }

  function playItem(item: IPlaylistAudio) {
    play({ path: item.path })
    app.value = { ...app.value, audioCurrent: item.path }
  }

  function deleteItem(item: IPlaylistAudio) {
    deleteAudio({ path: item.path })
    const items = [...app.value.audios]
    arrayRemove(items, (it) => it.path === item.path)
    app.value = { ...app.value, audios: items }
  }

  function onReorder() {
    reorderPlaylistAudios({ paths: playlistAudios.value.map((item) => item.path) })
  }

  function clearPlaylist() {
    clear()
    clearDone()
  }

  onMounted(() => {
    emitter.on('do_play_audio', () => setTimeout(_play, 500))
    emitter.on('pause_audio', () => audioRef.value?.pause())
    audioRef.value?.addEventListener('pause', () => { audioPlaying.value = false })
    audioRef.value?.addEventListener('play', () => { audioPlaying.value = true })
  })

  return {
    app,
    audios,
    playlistAudios,
    current,
    src,
    clearLoading,
    onEnded,
    playPrev,
    playNext,
    changeMode,
    playItem,
    deleteItem,
    clearPlaylist,
    onReorder,
  }
}
