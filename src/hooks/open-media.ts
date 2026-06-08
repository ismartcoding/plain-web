import { type Ref } from 'vue'
import { openMediaInWindow } from '@/lib/api/tauri-window'
import type { ISource } from '@/components/lightbox/types'
import { useTempStore } from '@/stores/temp'

/**
 * Single entry point for "open this media file for preview".
 *
 * Routes by runtime:
 *   - Tauri  → spawns a new top-level window at `/media-preview` (the
 *              MediaPreviewView page owns its own Lightbox instance).
 *   - Web    → pushes the source into `tempStore.lightbox` so the in-page
 *              Lightbox overlay picks it up.
 *
 * The point of centralising the `__IS_TAURI__` branch here is so callers
 * never repeat the "if Tauri open new window, else set lightbox" dance
 * and never reach for `tempStore.lightbox` directly — a future change
 * (e.g. routing to `/media-preview` instead of opening a window) only
 * has to land in one place.
 *
 * @param sources Optional default source list. Pass it for the simple
 *   `open(index)` form (videos/images grid). Callers that pre-filter the
 *   list at click time (e.g. "open the image/video subset of the file
 *   list") can omit it and always pass `open(index, override)`.
 */
export function useOpenMedia(sources?: Ref<ISource[]>) {
  const tempStore = useTempStore()

  function open(index: number, override?: ISource[]): void {
    const list = override ?? sources?.value
    if (!list) return
    const source = list[index]
    if (!source) return
    tempStore.lightbox = { sources: list, index, visible: true }
  }

  return { open }
}
