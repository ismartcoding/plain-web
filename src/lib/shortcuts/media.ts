export interface ShortcutItem {
    keys: string[]
    description: string
}

export const mediaKeyboardShortcuts: ShortcutItem[] = [
    { keys: ['Delete'], description: 'delete_selected' },
    { keys: ['modifier', '+', 'Backspace'], description: 'delete_selected' },
    { keys: ['modifier', '+', 'A'], description: 'select_all' },
    { keys: ['Esc'], description: 'clear_selection' },
    { keys: ['←', '→'], description: 'navigate_pages' },
    { keys: ['Shift', '+', 'Click'], description: 'range_select' },
]
