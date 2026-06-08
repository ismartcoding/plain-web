import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// In vitest `VITE_APP_MODE` is unset, so vite's `define` plugin compiles
// `__IS_TAURI__` to the literal `false` — i.e. the web build path. That's
// the path we actually need to lock in here: a web build must never treat
// "no bound device" as an authenticated local session. The Tauri branch
// is a one-liner (`__IS_TAURI__ && isLocalMode()`) and is exercised
// manually in the desktop app.
const loadLocalMode = async () => {
  const mod = await import('@/lib/local-mode')
  return mod
}

const loadWindowClient = async () => {
  const mod = await import('@/lib/window-client')
  return mod
}

describe('local-mode', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('isLocalModeAllowed() is false in web builds even when no device is bound', async () => {
    const lm = await loadLocalMode()
    const wc = await loadWindowClient()
    // Sanity: the underlying state really is "local mode" — no bound device,
    // no session token. The whole point of this test is that the helper
    // refuses to act on that in a web build.
    expect(wc.isLocalMode()).toBe(true)
    expect(lm.isLocalModeAllowed()).toBe(false)
  })

  it('isLocalModeAllowed() is false in web builds even after binding a device', async () => {
    const lm = await loadLocalMode()
    const wc = await loadWindowClient()
    wc.setBoundClientId('device-xyz')
    expect(wc.isLocalMode()).toBe(false)
    expect(lm.isLocalModeAllowed()).toBe(false)
  })

  it('isLocalModeAllowed() and isLocalRouteGroup() are independent helpers', async () => {
    const lm = await loadLocalMode()
    expect(typeof lm.isLocalModeAllowed).toBe('function')
    expect(typeof lm.isLocalRouteGroup).toBe('function')
    expect(lm.isLocalRouteGroup('home')).toBe(true)
    expect(lm.isLocalRouteGroup('chat')).toBe(true)
    expect(lm.isLocalRouteGroup('files')).toBe(false)
  })
})
