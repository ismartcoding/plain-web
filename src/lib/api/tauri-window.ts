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
