import { get as prefsGet, set as prefsSet } from '@/lib/prefs'
import {
  getWindowClientId,
  isLocalMode as _isLocalMode,
  clearBoundClientId,
} from '@/lib/window-client'

const SESSIONS_KEY = 'device_sessions'

interface SessionEntry {
  clientId: string
  host: string
  token: string
  name?: string
}

interface SessionsStorage {
  sessions: SessionEntry[]
}

function readSessionsStorage(): SessionsStorage {
  try {
    const p = prefsGet<SessionsStorage | null>(SESSIONS_KEY, null)
    if (!p || !Array.isArray(p.sessions)) return { sessions: [] }
    return { sessions: p.sessions }
  } catch {
    return { sessions: [] }
  }
}

export { _isLocalMode as isLocalMode }

export function getCurrentDeviceHost(): string {
  const { sessions } = readSessionsStorage()
  return sessions.find((s) => s.clientId === getWindowClientId())?.host ?? ''
}

export function getCurrentAuthToken(): string {
  const { sessions } = readSessionsStorage()
  return sessions.find((s) => s.clientId === getWindowClientId())?.token ?? ''
}

/**
 * Clear auth on failure (e.g. 401 from server).
 * Clears the token of the current session (so the user must re-authenticate)
 * and drops the per-window binding back to local mode. The session entry
 * itself is kept in the list so the user can re-auth later.
 */
export function clearCurrentSession(): void {
  try {
    const p = prefsGet<SessionsStorage | null>(SESSIONS_KEY, null)
    if (!p) return
    const currentId = getWindowClientId()
    if (currentId && Array.isArray(p.sessions)) {
      const session = p.sessions.find((s) => s.clientId === currentId)
      if (session) session.token = ''
      prefsSet(SESSIONS_KEY, p)
    }
    clearBoundClientId()
  } catch {
    // Swallow storage errors (quota, disabled localStorage, etc.) so a
    // single failed clear doesn't crash the surrounding auth/UI flow.
  }
}

/** Compute the per-device localStorage key for the main store snapshot. */
export function getMainStateKey(): string {
  const id = getWindowClientId()
  return id ? `main_state:${id}` : 'main_state'
}