import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'
import { contextmenu } from '@/components/contextmenu'

export function useRevealFile() {
  const { t } = useI18n()

  function onContextMenu(e: MouseEvent, path: string) {
    if (!__IS_TAURI__ || !path || path.startsWith('fsid:')) return
    e.preventDefault()
    contextmenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: String(t('show_in_finder')),
          onClick: () => {
            invoke('reveal_chat_file', { uri: path }).catch((err) => console.error('reveal_chat_file failed', err))
          },
        },
      ],
    })
  }

  return { onContextMenu }
}
