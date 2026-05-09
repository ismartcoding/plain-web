/**
 * Synchronous accessors for the currently active device.
 * Reads directly from the `device_sessions` localStorage key, which is kept
 * in sync by the Pinia store (`stores/device-sessions.ts`) via `persist()`.
 *
 * Works in modules that execute before Pinia is initialised (api.ts, router.ts, login.ts).
 * Both web and Tauri use the same storage structure — no branching on __IS_TAURI__.
 */

const SESSIONS_KEY = 'device_sessions'

interface SessionsStorage {
  sessions: Array<{ clientId: string; host: string; token: string; name?: string }>
  currentClientId: string
}

function readSessionsStorage(): SessionsStorage {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return { sessions: [], currentClientId: '' }
    const p = JSON.parse(raw)
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
 * and clears `currentClientId` so the router redirects to /login.
 * The session entry itself is kept in the list so the user can click it to re-auth.
 */
export function clearCurrentSession(): void {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return
    const p = JSON.parse(raw)
    const currentId = typeof p.currentClientId === 'string' ? p.currentClientId : ''
    // Clear the stale token so resumeSession won't skip re-authentication.
    if (currentId && Array.isArray(p.sessions)) {
      const session = p.sessions.find((s: any) => s.clientId === currentId)
      if (session) session.token = ''
    }
    p.currentClientId = ''
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(p))
  } catch {}
}

/** Compute the per-device localStorage key for the main store snapshot. */
export function getMainStateKey(): string {
  const id = getCurrentClientId()
  return id ? `main_state:${id}` : 'main_state'
}
