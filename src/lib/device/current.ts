import { get as prefsGet, set as prefsSet } from '@/lib/prefs'
import {
  getRemoteClientId,
  getActiveClientId,
  isLocalMode as _isLocalMode,
  clearRemoteClientId,
} from '@/lib/device/client-id'

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
  return sessions.find((s) => s.clientId === getRemoteClientId())?.host ?? ''
}

export function getCurrentAuthToken(): string {
  const { sessions } = readSessionsStorage()
  return sessions.find((s) => s.clientId === getRemoteClientId())?.token ?? ''
}

export function clearCurrentSession(): void {
  try {
    const p = prefsGet<SessionsStorage | null>(SESSIONS_KEY, null)
    if (!p) return
    const currentId = getRemoteClientId()
    if (currentId && Array.isArray(p.sessions)) {
      const session = p.sessions.find((s) => s.clientId === currentId)
      if (session) session.token = ''
      prefsSet(SESSIONS_KEY, p)
    }
    clearRemoteClientId()
  } catch {
    // Swallow storage errors (quota, disabled localStorage, etc.) so a
    // single failed clear doesn't crash the surrounding auth/UI flow.
  }
}

export function getMainStateKey(): string {
  const id = getActiveClientId()
  return id ? `main_state:${id}` : 'main_state'
}