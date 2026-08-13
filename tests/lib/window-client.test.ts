import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Each test resets the module cache so cached singletons in client-id.ts
// (cachedRemote / cachedWindowId) start fresh and pick up the new
// sessionStorage from the test setup's reset.
const loadClientId = async () => {
  vi.resetModules()
  const mod = await import('@/lib/device/client-id')
  return mod
}

describe('client-id', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('getRemoteClientId returns "" when no device is bound', async () => {
    const wc = await loadClientId()
    expect(wc.getRemoteClientId()).toBe('')
  })

  it('getActiveClientId falls back to the desktop clientId when nothing is bound', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadClientId()
    expect(wc.getActiveClientId()).toBe('desktop-abc')
    expect(wc.isLocalMode()).toBe(true)
  })

  it('getActiveClientId returns the bound device id when one is set', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadClientId()
    wc.setRemoteClientId('device-xyz')
    expect(wc.getRemoteClientId()).toBe('device-xyz')
    expect(wc.getActiveClientId()).toBe('device-xyz')
    expect(wc.isLocalMode()).toBe(false)
  })

  it('clearRemoteClientId drops the window back to local mode', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadClientId()
    wc.setRemoteClientId('device-xyz')
    wc.clearRemoteClientId()
    expect(wc.getRemoteClientId()).toBe('')
    expect(wc.getActiveClientId()).toBe('desktop-abc')
    expect(wc.isLocalMode()).toBe(true)
  })

  it('setRemoteClientId("") is equivalent to clear', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadClientId()
    wc.setRemoteClientId('device-xyz')
    wc.setRemoteClientId('')
    expect(wc.getRemoteClientId()).toBe('')
  })

  it('getWindowId is stable across module reloads and unique per window', async () => {
    const a = (await loadClientId()).getWindowId()
    const b = (await loadClientId()).getWindowId()
    expect(a).toBe(b)
    expect(sessionStorage.getItem('__window_id__')).toBe(a)
  })

  it('isLocalClientId compares against the desktop clientId', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    const wc = await loadClientId()
    expect(wc.isLocalClientId('')).toBe(true)
    expect(wc.isLocalClientId('desktop-abc')).toBe(true)
    expect(wc.isLocalClientId('some-device')).toBe(false)
  })

  it('applyUrlClientId writes __cid into the bound sessionStorage and strips it from URL', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    window.history.replaceState({}, '', '/?__cid=device-42&other=keep')
    const wc = await loadClientId()
    wc.applyUrlClientId()
    expect(wc.getRemoteClientId()).toBe('device-42')
    expect(wc.getActiveClientId()).toBe('device-42')
    expect(wc.isLocalMode()).toBe(false)
    const after = window.location.search
    expect(after).not.toContain('__cid')
    expect(after).toContain('other=keep')
  })

  it('applyUrlClientId is a no-op when there is no __cid', async () => {
    localStorage.setItem('client_id', 'desktop-abc')
    window.history.replaceState({}, '', '/?x=1')
    const wc = await loadClientId()
    const before = wc.getActiveClientId()
    wc.applyUrlClientId()
    expect(wc.getActiveClientId()).toBe(before)
  })
})