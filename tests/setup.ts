/**
 * Global test setup for Vitest Browser Mode (`unit` project).
 *
 * In Browser Mode (Playwright provider) tests run inside a real Chromium,
 * so `localStorage`, `sessionStorage`, `BroadcastChannel`, `crypto` etc.
 * are all native browser APIs.
 *
 * This setup runs in BOTH the Vite dev-server context (Node) AND the
 * browser context (per test). Anything that touches `window` /
 * `localStorage` / `sessionStorage` must be guarded with `typeof` checks
 * because those globals don't exist on the Node side.
 *
 * We don't stub `BroadcastChannel` here. The cross-window-store tests
 * are split into a separate Node project (`cws`) where module-level
 * state can actually be reset; here we rely on real BroadcastChannel
 * behavior, which works fine for the other suites that don't simulate
 * multiple windows in one test.
 */
import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
})

vi.spyOn(console, 'info').mockReturnValue(undefined)
