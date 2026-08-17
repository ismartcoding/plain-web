import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export type DlnaMediaType = 'VIDEO' | 'AUDIO' | 'IMAGE' | 'UNKNOWN'

// Mirrors plain-app's `DlnaRendererState` snapshotted by the Rust
// `dlna_state` command. `playbackState` is a string like "PLAYING".
export interface DlnaStateSnapshot {
  enabled: boolean
  isRunning: boolean
  isRetrying: boolean
  port: number
  mediaUri: string
  mediaTitle: string
  mediaAlbumArtUri: string
  mediaType: DlnaMediaType
  playbackState: string
  currentPositionMs: number
  durationMs: number
  pendingCastRequest: PendingCastRequest | null
  startError: string
}

export interface PendingCastRequest {
  senderIp: string
  senderName: string
  mediaUri: string
  mediaTitle: string
  mediaType: DlnaMediaType
  albumArtUri: string
}

export interface DlnaSenders {
  allowed: string[]
  denied: string[]
}

// Mirrors plain-app's `TempData.dlnaEnabled` + the receiver engine state.
// The desktop keeps DLNA running only while the toggle is on; toggling here
// persists the preference and starts/stops the Rust renderer engine.
export function useDlna() {
  const snapshot = ref<DlnaStateSnapshot | null>(null)
  const loading = ref(false)

  async function load() {
    if (!__IS_TAURI__) return
    try {
      snapshot.value = await invoke<DlnaStateSnapshot>('dlna_state')
    } catch (e) {
      console.error('dlna_state failed', e)
    }
  }

  async function setEnabled(enabled: boolean) {
    if (!__IS_TAURI__) return
    loading.value = true
    try {
      await invoke('dlna_set_enabled', { enabled })
      await load()
    } catch (e) {
      console.error('dlna_set_enabled failed', e)
    } finally {
      loading.value = false
    }
  }

  async function loadSenders(): Promise<DlnaSenders> {
    if (!__IS_TAURI__) return { allowed: [], denied: [] }
    try {
      return await invoke<DlnaSenders>('dlna_senders')
    } catch (e) {
      console.error('dlna_senders failed', e)
      return { allowed: [], denied: [] }
    }
  }

  return { snapshot, loading, load, setEnabled, loadSenders }
}
