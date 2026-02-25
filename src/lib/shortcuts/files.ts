import type { ShortcutItem } from './media'

export const filesKeyboardShortcuts: ShortcutItem[] = [
  { keys: ['Delete'], description: 'delete_selected' },
  { keys: ['modifier', '+', 'Backspace'], description: 'delete_selected' },
  { keys: ['modifier', '+', 'A'], description: 'select_all' },
  { keys: ['Esc'], description: 'clear_selection' },
  { keys: ['Shift', '+', 'Click'], description: 'range_select' },
]
