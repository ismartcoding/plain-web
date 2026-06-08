import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Each test resets the module cache so cached singletons in window-client.ts
// (cachedBound / cachedWindowId) start fresh and pick up the new
// sessionStorage from the test setup's reset.
const loadWindowClient = async () => {
  vi.resetModules()
  const mod = await import('@/lib/window-client')
  return mod
}

describe('window-client', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('getBoundClientId returns "" when no device is bound', async () => {
    const wc = await loadWindowClient()
    expect(wc.getBoundClientId()).toBe('')
  })

  it('getWindowClientId falls back to the desktop clientId when nothing is bound', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadWindowClient()
    expect(wc.getWindowClientId()).toBe('desktop-abc')
    expect(wc.isLocalMode()).toBe(true)
  })

  it('getWindowClientId returns the bound device id when one is set', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadWindowClient()
    wc.setBoundClientId('device-xyz')
    expect(wc.getBoundClientId()).toBe('device-xyz')
    expect(wc.getWindowClientId()).toBe('device-xyz')
    expect(wc.isLocalMode()).toBe(false)
  })

  it('clearBoundClientId drops the window back to local mode', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadWindowClient()
    wc.setBoundClientId('device-xyz')
    wc.clearBoundClientId()
    expect(wc.getBoundClientId()).toBe('')
    expect(wc.getWindowClientId()).toBe('desktop-abc')
    expect(wc.isLocalMode()).toBe(true)
  })

  it('setBoundClientId("") is equivalent to clear', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadWindowClient()
    wc.setBoundClientId('device-xyz')
    wc.setBoundClientId('')
    expect(wc.getBoundClientId()).toBe('')
  })

  it('getWindowId is stable across module reloads and unique per window', async () => {
    const a = (await loadWindowClient()).getWindowId()
    const b = (await loadWindowClient()).getWindowId()
    expect(a).toBe(b)
    expect(sessionStorage.getItem('__window_id__')).toBe(a)
  })

  it('isLocalClientId compares against the desktop clientId', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadWindowClient()
    expect(wc.isLocalClientId('')).toBe(true)
    expect(wc.isLocalClientId('desktop-abc')).toBe(true)
    expect(wc.isLocalClientId('some-device')).toBe(false)
  })

  it('applyUrlClientId writes __cid into the bound sessionStorage and strips it from URL', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    window.history.replaceState({}, '', '/?__cid=device-42&other=keep')
    const wc = await loadWindowClient()
    wc.applyUrlClientId()
    expect(wc.getBoundClientId()).toBe('device-42')
    expect(wc.getWindowClientId()).toBe('device-42')
    expect(wc.isLocalMode()).toBe(false)
    const after = window.location.search
    expect(after).not.toContain('__cid')
    expect(after).toContain('other=keep')
  })

  it('applyUrlClientId is a no-op when there is no __cid', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    window.history.replaceState({}, '', '/?x=1')
    const wc = await loadWindowClient()
    const before = wc.getWindowClientId()
    wc.applyUrlClientId()
    expect(wc.getWindowClientId()).toBe(before)
  })
})