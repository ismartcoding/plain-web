import { initMutation, addPlaylistAudiosGQL, playAudioGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import { ref, type Ref } from 'vue'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import type { IAudio, IAudioItem, ISelectable } from '@/lib/interfaces'
import { transferEffect } from '@/lib/effect'

export const useAddToPlaylist = (items: Ref<IAudioItem[]>, clearSelection: () => void) => {
  const { mutate, loading, onDone } = initMutation({
    document: addPlaylistAudiosGQL,
    appApi: true,
  })

  const { t } = useI18n()

  onDone(() => {
    emitter.emit('refetch_app')
    clearSelection()
  })

  return {
    loading,
    addItemsToPlaylist: (e: MouseEvent, realAllChecked: boolean, query: string) => {
      let q = query
      if (!realAllChecked) {
        const selectedItems = items.value.filter((it: ISelectable) => it.checked)
        if (selectedItems.length === 0) {
          toast(t('select_first'), 'error')
          return
        }
        q = `ids:${selectedItems.map((it: any) => it.id).join(',')}`
      }

      const sourceElement = e.target
      const targetElement = document.getElementById('quick-audio')
      transferEffect(sourceElement, targetElement)

      mutate({ query: q })
    },
    addToPlaylist: (e: MouseEvent, item: IAudio) => {
      const sourceElement = e.target
      const targetElement = document.getElementById('quick-audio')
      transferEffect(sourceElement, targetElement)
      mutate({ query: `ids:${item.id}` })
    },
  }
}

export const useAudioPlayer = () => {
  const playPath = ref('')

  const { mutate, loading, onDone } = initMutation({
    document: playAudioGQL,
    appApi: true,
  })

  onDone(() => {
    emitter.emit('play_audio')
  })

  return {
    loading,
    playPath,
    play: (item: IAudio) => {
      playPath.value = item.path
      mutate({
        path: item.path,
      })
    },
    pause: () => {
      emitter.emit('pause_audio')
    },
  }
}
