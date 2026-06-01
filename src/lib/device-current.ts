/**
 * Synchronous accessors for the currently active device.
 * Reads directly from the `device_sessions` prefs key, kept in sync by the
 * Pinia store (`stores/device-sessions.ts`) via `persist()`.
 *
 * Works in modules that execute before Pinia is initialised (api.ts, router.ts, login.ts).
 * Both web and Tauri use the same storage structure — no branching on __IS_TAURI__.
 */
import { get as prefsGet, set as prefsSet } from '@/lib/prefs'
import { LOCAL_CLIENT_ID } from '@/stores/device-sessions'

const SESSIONS_KEY = 'device_sessions'

interface SessionsStorage {
  sessions: Array<{ clientId: string; host: string; token: string; name?: string }>
  currentClientId: string
}

function readSessionsStorage(): SessionsStorage {
  try {
    const p = prefsGet<SessionsStorage | null>(SESSIONS_KEY, null)
    if (!p) return { sessions: [], currentClientId: '' }
    return {
      sessions: Array.isArray(p.sessions) ? p.sessions : [],
      currentClientId: typeof p.currentClientId === 'string' ? p.currentClientId : '',
    }
  } catch {
    return { sessions: [], currentClientId: '' }
  }
}

export function getCurrentClientId(): string {
  return readSessionsStorage().currentClientId
}

export function getCurrentDeviceHost(): string {
  const { sessions, currentClientId } = readSessionsStorage()
  return sessions.find((s) => s.clientId === currentClientId)?.host ?? ''
}

/** Return the auth token for the current session. */
export function getCurrentAuthToken(): string {
  const { sessions, currentClientId } = readSessionsStorage()
  return sessions.find((s) => s.clientId === currentClientId)?.token ?? ''
}

/**
 * Clear auth on failure (e.g. 401 from server).
 * Clears the token of the current session (so the user must re-authenticate)
 * and switches the active device back to desktop local mode.
 * The session entry itself is kept in the list so the user can re-auth later.
 */
export function clearCurrentSession(): void {
  try {
    const p = prefsGet<SessionsStorage | null>(SESSIONS_KEY, null)
    if (!p) return
    const currentId = typeof p.currentClientId === 'string' ? p.currentClientId : ''
    if (currentId && Array.isArray(p.sessions)) {
      const session = p.sessions.find((s: any) => s.clientId === currentId)
      if (session) session.token = ''
    }
    p.currentClientId = LOCAL_CLIENT_ID
    prefsSet(SESSIONS_KEY, p)
  } catch {}
}

/** Compute the per-device localStorage key for the main store snapshot. */
export function getMainStateKey(): string {
  const id = getCurrentClientId()
  return id ? `main_state:${id}` : 'main_state'
}
