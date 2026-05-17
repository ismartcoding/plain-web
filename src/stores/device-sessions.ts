import { defineStore } from 'pinia'

/**
 * Sentinel clientId for the built-in "local" session (no connected device).
 * Stored as currentClientId to signal local mode instead of empty string,
 * so the value is always meaningful and consistent across all consumers.
 */
export const LOCAL_CLIENT_ID = '__local__'

/**
 * Persistent registry of devices the user has previously logged into,
 * scoped to the Tauri desktop app. Lets the user switch between known
 * devices without re-authenticating each time.
 *
 * Keyed by `clientId` (the device's `TempData.clientId`, returned from the
 * `/auth` WebSocket handshake — see `AuthResponse` in plain-app). The host
 * (`ip:port`) is just transport addressing and is allowed to change when
 * the device moves networks; identity is the immutable `clientId`.
 */

export interface DeviceSession {
  clientId: string
  host: string // "ip:port"
  name?: string
  token: string
  addedAt: number
}

export type DeviceSessionsState = {
  sessions: DeviceSession[]
  /**
   * `clientId` of the device the app is currently connected to, or '' if
   * the user is not logged in.
   */
  currentClientId: string
}

const STORAGE_KEY = 'device_sessions'

function loadFromStorage(): DeviceSessionsState {
  const fallback: DeviceSessionsState = { sessions: [], currentClientId: LOCAL_CLIENT_ID }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return fallback
    const sessions: DeviceSession[] = Array.isArray(parsed.sessions)
      ? parsed.sessions.filter(
          (s: any) =>
            s && typeof s.clientId === 'string' && s.clientId
              && typeof s.host === 'string'
              && typeof s.token === 'string'
        )
      : []
    // Migrate legacy empty-string currentClientId to LOCAL_CLIENT_ID.
    const stored = typeof parsed.currentClientId === 'string' ? parsed.currentClientId : ''
    const currentClientId = stored || LOCAL_CLIENT_ID
    return { sessions, currentClientId }
  } catch {
    return fallback
  }
}

export const useDeviceSessionsStore = defineStore('deviceSessions', {
  state: (): DeviceSessionsState => loadFromStorage(),
  getters: {
    sortedSessions(state): DeviceSession[] {
      return [...state.sessions].sort((a, b) => b.addedAt - a.addedAt)
    },
    currentSession(state): DeviceSession | undefined {
      return state.sessions.find((s) => s.clientId === state.currentClientId)
    },
  },
  actions: {
    persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sessions: this.sessions,
          currentClientId: this.currentClientId,
        })
      )
    },
    /**
     * Insert or update a session for the given device. `addedAt` is preserved
     * across updates so an existing entry doesn't jump to the top of the list
     * just because the user re-authenticated.
     */
    save(input: { clientId: string; host: string; name?: string; token: string }) {
      if (!input.clientId) return
      const existing = this.sessions.find((s) => s.clientId === input.clientId)
      const next: DeviceSession = {
        clientId: input.clientId,
        host: input.host,
        name: input.name,
        token: input.token,
        addedAt: existing?.addedAt ?? Date.now(),
      }
      this.sessions = [
        ...this.sessions.filter((s) => s.clientId !== input.clientId),
        next,
      ]
      this.persist()
    },
    setCurrent(clientId: string) {
      this.currentClientId = clientId
      this.persist()
    },
    remove(clientId: string) {
      this.sessions = this.sessions.filter((s) => s.clientId !== clientId)
      if (this.currentClientId === clientId) this.currentClientId = LOCAL_CLIENT_ID
      // Also clean up the persisted main state for this device.
      localStorage.removeItem(`main_state:${clientId}`)
      this.persist()
    },
    /** Update the display name for an existing session (e.g. after fetching app.deviceName). */
    updateName(clientId: string, name: string) {
      const i = this.sessions.findIndex((s) => s.clientId === clientId)
      if (i < 0 || !name) return
      this.sessions[i] = { ...this.sessions[i], name }
      this.persist()
    },
    /** Change the host (`ip:port`) of an existing session, e.g. after the user edits the IP. */
    updateHost(clientId: string, host: string) {
      const next = host.trim()
      if (!next) return
      const i = this.sessions.findIndex((s) => s.clientId === clientId)
      if (i < 0) return
      this.sessions[i] = { ...this.sessions[i], host: next }
      this.persist()
    },
  },
})
