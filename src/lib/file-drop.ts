/**
 * Tauri windows disable the native drag-drop handler (see `dragDropEnabled`
 * in tauri.conf.json) so the webview keeps receiving HTML5 drag events.
 * Without that handler the OS drop falls back to the webview default, which
 * navigates to `file://<path>` and tears the SPA down. Swallow file drops
 * that no component handled.
 */
export function preventUnhandledFileDrop() {
  const swallow = (e: DragEvent) => {
    if (e.defaultPrevented) {
      return
    }
    // Text drops keep their native behaviour (e.g. into a textarea).
    if (!e.dataTransfer?.types.includes('Files')) {
      return
    }
    // `<input type="file">` fills itself through the native drop action.
    const target = e.target as HTMLElement | null
    if (target instanceof HTMLInputElement && target.type === 'file') {
      return
    }
    e.preventDefault()
  }
  window.addEventListener('dragover', swallow)
  window.addEventListener('drop', swallow)
}
