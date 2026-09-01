import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'
import { contextmenu } from '@/components/contextmenu'
import { isLocalMode } from '@/lib/device/local-mode'
import { isMacPlatform } from '@/lib/platform'

export function useRevealFile() {
  const { t } = useI18n()

  function onContextMenu(e: MouseEvent, path: string, name: string = '') {
    if (!isLocalMode() || !path || path.startsWith('fsid:')) return
    e.preventDefault()
    const items = [
      {
        label: String(t('show_in_finder')),
        onClick: () => {
          invoke('reveal_chat_file', { uri: path }).catch((err) => console.error('reveal_chat_file failed', err))
        },
      },
      {
        label: String(t('save_as')),
        onClick: () => {
          invoke('save_chat_file_as', { uri: path, name }).catch((err) => console.error('save_chat_file_as failed', err))
        },
      },
    ]
    if (isMacPlatform()) {
      items.push({
        label: String(t('copy')),
        onClick: () => {
          invoke('copy_chat_file_to_clipboard', { uri: path }).catch((err) => console.error('copy_chat_file_to_clipboard failed', err))
        },
      })
    }
    contextmenu({
      x: e.clientX,
      y: e.clientY,
      items,
    })
  }

  return { onContextMenu }
}
