import { invoke } from '@tauri-apps/api/core'

/**
 * Open a new app window at the given router path (e.g. "/messages").
 * If a window at that exact path is already open, it receives focus instead.
 * No-op outside Tauri.
 */
export async function openWindow(path: string): Promise<void> {
  if (!__IS_TAURI__) return
  await invoke('open_window', { path })
}

/**
 * Update the display name shown for this window in the macOS dock right-click menu.
 * Should be called whenever the active device session changes.
 * No-op outside Tauri or on non-macOS platforms.
 */
export async function setWindowDeviceName(name: string): Promise<void> {
  if (!__IS_TAURI__) return
  await invoke('set_window_device_name', { name })
}
