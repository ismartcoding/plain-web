import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

/**
 * Simulates two Tauri webviews (or two browser tabs) sharing the same
 * BroadcastChannel by giving each its own sessionStorage values. We
 * `vi.resetModules()` between windows so each gets fresh module-level
 * caches, and pre-touch the cached getters so the identity is captured
 * before a later loadAsWindow() can stomp sessionStorage.
 *
 * `boundClientId` simulates a per-window device binding (set by the user
 * via the device switcher, or by `?__cid=` from a parent window). When
 * set, `getWindowClientId()` returns it; otherwise it falls back to the
 * desktop clientId (here mocked via localStorage).
 */
const loadAsWindow = async (
  boundClientId: string | null,
  windowId: string,
  desktopClientId = 'desktop-1',
) => {
  sessionStorage.clear()
  if (boundClientId) sessionStorage.setItem('__bound_client_id__', boundClientId)
  sessionStorage.setItem('__window_id__', windowId)
  localStorage.setItem('client_id', desktopClientId)
  vi.resetModules()
  const wc = await import('@/lib/window-client')
  wc.getWindowId()
  wc.getWindowClientId()
  const cws = await import('@/lib/cross-window-store')
  return { wc, cws }
}

describe('cross-window-store', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('publishes only the declared syncKeys', async () => {
    // Two windows bound to the same device.
    const { cws } = await loadAsWindow('device-1', 'win-A')
    const useStore = cws.defineCrossWindowStore<'kv-test', { a: number; b: number }>(
      'kv-test',
      { state: () => ({ a: 0, b: 0 }) },
      { syncKeys: ['a'] },
    )

    const received: Array<{ a: number; b: number }> = []
    const peer = await loadAsWindow('device-1', 'win-B')
    peer.cws.subscribeForTest('kv-test', (patch) => received.push(patch as any))

    const store = useStore()
    store.$patch({ a: 1, b: 99 })
    await new Promise((r) => setTimeout(r, 0))

    expect(received).toEqual([{ a: 1 }])
  })

  it('filters out messages from a different clientId', async () => {
    const publisher = await loadAsWindow('device-1', 'win-A')
    const subscriber = await loadAsWindow('device-2', 'win-B')

    const received: Array<unknown> = []
    subscriber.cws.subscribeForTest('cid-test', (patch) => received.push(patch))

    publisher.cws.publishForTest('cid-test', { x: 1 }, 'device-1')
    await new Promise((r) => setTimeout(r, 0))
    expect(received).toEqual([])
  })

  it('filters out self-broadcasts (same windowId)', async () => {
    const w = await loadAsWindow('device-1', 'win-A')
    const received: Array<unknown> = []
    w.cws.subscribeForTest('self-test', (patch) => received.push(patch))

    w.cws.publishForTest('self-test', { y: 2 }, 'device-1')
    await new Promise((r) => setTimeout(r, 0))
    expect(received).toEqual([])
  })

  it('delivers messages to peers bound to the same device', async () => {
    const pub = await loadAsWindow('device-1', 'win-A')
    const sub = await loadAsWindow('device-1', 'win-B')

    const received: Array<unknown> = []
    sub.cws.subscribeForTest('same-test', (patch) => received.push(patch))

    pub.cws.publishForTest('same-test', { z: 3 }, 'device-1')
    await new Promise((r) => setTimeout(r, 0))
    expect(received).toEqual([{ z: 3 }])
  })

  it('delivers messages between local-mode windows sharing the desktop id', async () => {
    // No bound clientId → both windows fall back to the desktop id.
    const pub = await loadAsWindow(null, 'win-A', 'desktop-1')
    const sub = await loadAsWindow(null, 'win-B', 'desktop-1')

    const received: Array<unknown> = []
    sub.cws.subscribeForTest('local-test', (patch) => received.push(patch))

    pub.cws.publishForTest('local-test', { local: true }, 'desktop-1')
    await new Promise((r) => setTimeout(r, 0))
    expect(received).toEqual([{ local: true }])
  })
})