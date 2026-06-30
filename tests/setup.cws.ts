/**
 * Node-environment setup for cross-window-store tests.
 *
 * `vi.resetModules()` works on the Node side, so we don't need a
 * `__reset*ForTest()` escape hatch in source. The test's loadAsWindow()
 * helper sets up sessionStorage / localStorage per simulated window and
 * resets the module cache to get a fresh window-client / cross-window-store
 * pair each time.
 *
 * Node 22+ has a built-in localStorage / sessionStorage only when run with
 * `--localstorage-file`; we shim them in-memory so the tests are portable.
 *
 * `BroadcastChannel` doesn't exist in Node, so we shim an in-memory
 * registry that fans out `postMessage` to every other instance of the
 * same channel name. This is what the spec defines; without it, the
 * cross-window-store tests cannot exercise the live broadcast path.
 */
import { beforeEach, vi } from 'vitest'

const _localStore: Record<string, string> = {}
const _sessionStore: Record<string, string> = {}

function makeStorage(store: Record<string, string>) {
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
}

// Node 22+ ships a `localStorage` global but its API surface is the
// file-backed Storage spec stub (no `clear` / `getItem` / `setItem`), which
// would crash every test that touches it. Stub whenever the global either
// is missing or lacks the Web Storage methods we rely on.
if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  vi.stubGlobal('localStorage', makeStorage(_localStore))
}
if (typeof sessionStorage === 'undefined' || typeof sessionStorage.clear !== 'function') {
  vi.stubGlobal('sessionStorage', makeStorage(_sessionStore))
}

if (typeof BroadcastChannel === 'undefined') {
  const _bcRegistry = new Map<string, Set<MockBC>>()
  class MockBC {
    name: string
    onmessage: ((ev: MessageEvent) => void) | null = null
    private _listeners: Array<(ev: MessageEvent) => void> = []
    constructor(name: string) {
      this.name = name
      let set = _bcRegistry.get(name)
      if (!set) {
        set = new Set()
        _bcRegistry.set(name, set)
      }
      set.add(this)
    }
    postMessage(data: unknown) {
      const peers = _bcRegistry.get(this.name)
      if (!peers) return
      for (const peer of peers) {
        if (peer === this) continue
        const ev = { data } as MessageEvent
        if (peer.onmessage) peer.onmessage(ev)
        for (const fn of peer._listeners) fn(ev)
      }
    }
    addEventListener(_type: 'message', fn: (ev: MessageEvent) => void) {
      this._listeners.push(fn)
    }
    removeEventListener(_type: 'message', fn: (ev: MessageEvent) => void) {
      const i = this._listeners.indexOf(fn)
      if (i >= 0) this._listeners.splice(i, 1)
    }
    close() {
      _bcRegistry.get(this.name)?.delete(this)
    }
  }
  vi.stubGlobal('BroadcastChannel', MockBC)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // `installed` is pinned on globalThis by cross-window-store; reset
  // before each test so the store install hooks re-fire.
  delete (globalThis as any).__plainWebInstalled
})

vi.spyOn(console, 'info').mockReturnValue(undefined)
