/**
 * Global test setup for vitest.
 * Sets up browser globals required by source code that run in happy-dom.
 */
import { vi } from 'vitest'

// Provide a fully-compliant in-memory localStorage.
// happy-dom v20 uses a Proxy that prevents property assignment and may not
// expose all standard methods correctly — we replace it outright.
const _store: Record<string, string> = {}
const _mockLocalStorage = {
  getItem: (key: string) => _store[key] ?? null,
  setItem: (key: string, value: string) => { _store[key] = String(value) },
  removeItem: (key: string) => { delete _store[key] },
  clear: () => { Object.keys(_store).forEach((k) => delete _store[k]) },
  get length() { return Object.keys(_store).length },
  key: (index: number) => Object.keys(_store)[index] ?? null,
}

// Use Object.defineProperty to bypass Proxy restrictions on happy-dom window
try {
  Object.defineProperty(globalThis, 'localStorage', {
    value: _mockLocalStorage,
    writable: true,
    configurable: true,
  })
} catch {
  vi.stubGlobal('localStorage', _mockLocalStorage)
}

// Reset localStorage before each test
beforeEach(() => {
  Object.keys(_store).forEach((k) => delete _store[k])
})

// Stub window.__SERVER_TIME__ — not set in test env, so time-sync uses 0 offset
;(window as any).__SERVER_TIME__ = undefined

// Stub window.fileIdMap for file.ts
window.fileIdMap = new Map()

// Suppress console.info noise from gql-client request/response logging
vi.spyOn(console, 'info').mockReturnValue(undefined)
