import emitter from '@/plugins/eventbus.js'

export type ColorMode = 'light' | 'dark' | 'auto'

export function isModeDark(mode: ColorMode, saveAutoMode = true) {
  let isDark = mode === 'dark'

  // Determines whether the auto mode should display light or dark.
  if (mode === 'auto') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (saveAutoMode) {
      // We have to save this because if the user closes the tab when it's light
      // and reopens it when it's dark, we need to know whether the last applied
      // 'auto' mode was correct.
      saveLastSavedAutoColorMode(isDark ? 'dark' : 'light')
    }
  }

  return isDark
}


export function getCurrentMode(): ColorMode | null {
  return localStorage.getItem('color-mode') as ColorMode | null
}

export function saveColorMode(mode: ColorMode) {
  localStorage.setItem('color-mode', mode)
}

export function getLastSavedAutoColorMode() {
  return localStorage.getItem('last-auto-color-mode') as 'light' | 'dark' | null
}

export function saveLastSavedAutoColorMode(mode: 'light' | 'dark') {
  localStorage.setItem('last-auto-color-mode', mode)
}

export function changeColor() {
  const lastColorMode = getCurrentMode()!
  const isDark = isModeDark(lastColorMode)
  applyDarkClass(isDark)
}

export function changeColorMode(mode: ColorMode) {
  const isDark = isModeDark(mode)
  saveColorMode(mode)
  applyDarkClass(isDark)
}

export function applyDarkClass(isDark?: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  emitter.emit('color_mode_changed')
}
