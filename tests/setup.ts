/**
 * Global test setup for vitest.
 * Sets up browser globals required by source code that run in happy-dom.
 */
import { vi } from 'vitest'

const _localStore: Record<string, string> = {}
const _mockLocalStorage = {
  getItem: (key: string) => _localStore[key] ?? null,
  setItem: (key: string, value: string) => { _localStore[key] = String(value) },
  removeItem: (key: string) => { delete _localStore[key] },
  clear: () => { Object.keys(_localStore).forEach((k) => delete _localStore[k]) },
  get length() { return Object.keys(_localStore).length },
  key: (index: number) => Object.keys(_localStore)[index] ?? null,
}

try {
  Object.defineProperty(globalThis, 'localStorage', {
    value: _mockLocalStorage,
    writable: true,
    configurable: true,
  })
} catch {
  vi.stubGlobal('localStorage', _mockLocalStorage)
}

const _sessionStore: Record<string, string> = {}
const _mockSessionStorage = {
  getItem: (key: string) => _sessionStore[key] ?? null,
  setItem: (key: string, value: string) => { _sessionStore[key] = String(value) },
  removeItem: (key: string) => { delete _sessionStore[key] },
  clear: () => { Object.keys(_sessionStore).forEach((k) => delete _sessionStore[k]) },
  get length() { return Object.keys(_sessionStore).length },
  key: (index: number) => Object.keys(_sessionStore)[index] ?? null,
}
try {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: _mockSessionStorage,
    writable: true,
    configurable: true,
  })
} catch {
  vi.stubGlobal('sessionStorage', _mockSessionStorage)
}

const _bcRegistry = new Map<string, Set<MockBroadcastChannel>>()
class MockBroadcastChannel {
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
try {
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    value: MockBroadcastChannel,
    writable: true,
    configurable: true,
  })
} catch {
  vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
}

beforeEach(() => {
  Object.keys(_localStore).forEach((k) => delete _localStore[k])
  Object.keys(_sessionStore).forEach((k) => delete _sessionStore[k])
  _bcRegistry.clear()
})

;(window as any).__SERVER_TIME__ = undefined

window.fileIdMap = new Map()

vi.spyOn(console, 'info').mockReturnValue(undefined)