import { initMutation, addPlaylistAudiosGQL, playAudioGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import { ref, type Ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import type { IAudio, IAudioItem, ISelectable } from '@/lib/interfaces'

export const useAddToPlaylist = (items: Ref<IAudioItem[]>) => {
  const { mutate, loading, onDone } = initMutation({
    document: addPlaylistAudiosGQL,
    appApi: true,
  })

  const { t } = useI18n()

  onDone(() => {
    emitter.emit('refetch_app')
    toast(t('added_to_playlist'))
  })

  return {
    loading,
    addToPlaylist: () => {
      const selectedItems = items.value.filter((it: ISelectable) => it.checked)
      if (selectedItems.length === 0) {
        toast(t('select_first'), 'error')
        return
      }

      mutate({ paths: selectedItems.map((it) => it.path) })
    },
  }
}

export const usePlay = () => {
  const playing = ref('')

  const { mutate, loading, onDone } = initMutation({
    document: playAudioGQL,
    appApi: true,
  })

  onDone(() => {
    emitter.emit('refetch_app')
    emitter.emit('play_audio')
  })

  return {
    loading,
    playing,
    play: (item: IAudio) => {
      playing.value = item.path
      mutate({
        path: item.path,
      })
    },
  }
}
