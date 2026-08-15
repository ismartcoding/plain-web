import { defineStore } from 'pinia'
import { get as prefsGet, set as prefsSet, remove as prefsRemove } from '@/lib/prefs'
import {
  getRemoteClientId,
  setRemoteClientId,
  clearRemoteClientId,
} from '@/lib/device/client-id'

/**
 * Persistent registry of devices the user has previously logged into,
 * scoped to the Tauri desktop app. Lets the user switch between known
 * devices without re-authenticating each time.
 *
 * Keyed by `clientId` (the device's `TempData.clientId`, returned from the
 * `/auth` WebSocket handshake — see `AuthResponse` in plain-app). The host
 * (`ip:port`) is just transport addressing and is allowed to change when
 * the device moves networks; identity is the immutable `clientId`.
 *
 * `currentClientId` is NOT part of persisted state — it lives in
 * sessionStorage as the bound device (see `@/lib/device/client-id`). The store
 * exposes it via a getter so existing call sites (`store.currentClientId`)
 * keep working unchanged.
 */

export interface DeviceSession {
  clientId: string
  host: string // "ip:port"
  name?: string
  token: string
  signaturePublicKey?: string  // TOFU: server Ed25519 public key for signature verification
  deviceType?: string
  createdAt: string
}

export type DeviceSessionsState = {
  sessions: DeviceSession[]
}

const STORAGE_KEY = 'device_sessions'

function loadFromStorage(): DeviceSessionsState {
  try {
    const data = prefsGet<{ sessions: DeviceSession[] }>(STORAGE_KEY, { sessions: [] })
    const now = new Date().toISOString()
    return {
      sessions: (data?.sessions ?? []).map((s) => ({
        ...s,
        createdAt: s.createdAt ?? now,
      })),
    }
  } catch {
    return { sessions: [] }
  }
}

export const useDeviceSessionsStore = defineStore('deviceSessions', {
  state: (): DeviceSessionsState => loadFromStorage(),
  getters: {
    sortedSessions(state): DeviceSession[] {
      return [...state.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    /**
     * The bound remote device for this window, or '' in local mode. This is
     * the key used to look up `currentSession` — sessions are keyed only by
     * remote device ids, so an unbound (local) window correctly has no session.
     */
    currentClientId(): string {
      return getRemoteClientId()
    },
    currentSession(state): DeviceSession | undefined {
      return state.sessions.find((s) => s.clientId === this.currentClientId)
    },
  },
  actions: {
    persist() {
      prefsSet(STORAGE_KEY, { sessions: this.sessions })
    },
    /**
     * Insert or update a session for the given device. `createdAt` is preserved
     * across updates so an existing entry doesn't jump to the top of the list
     * just because the user re-authenticated.
     */
    save(input: { clientId: string; host: string; name?: string; token: string; signaturePublicKey?: string; deviceType?: string }) {
      if (!input.clientId) return
      const existing = this.sessions.find((s) => s.clientId === input.clientId)
      const next: DeviceSession = {
        clientId: input.clientId,
        host: input.host,
        name: input.name,
        token: input.token,
        signaturePublicKey: input.signaturePublicKey ?? existing?.signaturePublicKey,
        deviceType: input.deviceType ?? existing?.deviceType,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }
      this.sessions = [
        ...this.sessions.filter((s) => s.clientId !== input.clientId),
        next,
      ]
      this.persist()
    },
    /**
     * Bind this window to the given device. Pass the desktop clientId (from
     * `getDesktopClientId()`) to drop back to local mode, or pass '' to
     * clear the binding. The caller is responsible for reloading the page
     * so all stores/sockets re-init against the new device.
     */
    setCurrent(clientId: string) {
      if (clientId) setRemoteClientId(clientId)
      else clearRemoteClientId()
      this.persist()
    },
    remove(clientId: string) {
      this.sessions = this.sessions.filter((s) => s.clientId !== clientId)
      if (getRemoteClientId() === clientId) {
        // Drop the per-window binding so the caller can navigate to a
        // local-mode landing route or pick another device.
        clearRemoteClientId()
      }
      prefsRemove(`main_state:${clientId}`)
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
