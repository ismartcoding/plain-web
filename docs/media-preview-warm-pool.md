# Media Preview Warm Pool

> **Status: Implemented.** The warm pool design was fully implemented.
> See `src-tauri/src/commands/media_preview_pool.rs` for the Rust pool
> module, `src/lib/api/tauri-window.ts` for the frontend bridge, and
> `src/main.ts` for lifecycle wiring.

## Overview

## Design

### Pool shape

- Exactly **one** ready-to-use hidden window in the pool at all times
  (when the main window is alive).
- Lifecycle:
  1. **Cold start** — pool is empty.
  2. **First activate** — Rust builds a hidden `WebviewWindow` loaded with
     `dist/index.html#/media-preview?src=...&name=...&path=...`, waits for
     the SPA to mount `MediaPreviewView` (and for `MediaPreviewView` to
     set `tempStore.lightbox`), then parks it `visible: false`. Window is
     warm. (First-ever activate is just as slow as today — that's the
     cold-start cost we eat once.)
  3. **Activate** — promote to visible via `show()` + `set_focus()`.
     Pool becomes empty.
  4. **Refill** — pool is empty after activation, so Rust immediately
     builds a replacement hidden window for next time. (Refill happens
     **on a background thread / `tokio::task`**, not on the click
     thread — the user never waits for it.)
  5. **Close** — user closes the visible preview. Rust destroys the
     visible window. Pool is already warm (step 4 ensured it).

Net effect: every preview open after the first is **pool-take + show**,
no `WebviewWindowBuilder` build, no new webview allocation.

### Source switching inside a visible preview

If the user opens preview A, then clicks thumbnail B in the main window
without closing A, the existing visible window **stays** and we re-emit
the new `?src=...` URL via `WebviewWindow::set_url()` (or by pushing a
new route) so the same window re-renders. This is the "true native
feel" — no second window, no flicker, no extra IPC roundtrip for a new
process.

Conflict rule: the visible-window check uses the same `label` we mint in
Rust. One visible preview window at a time. If a second activate arrives
while a visible one exists, we still re-use it (just `set_focus()` +
update URL).

### Fallback to current path

If the pool is empty (cold start, first-ever activation, or the warm
window is still being built after a close → re-activate race), `activate()`
**falls back** to the existing `create_window("/media-preview?...")` path
in `commands/window.rs`. No functionality regression. The fallback stays
permanently — cost is one extra branch in Rust.

### What the warm window loads

The **same `dist/index.html`** the rest of the app uses, with the URL
hashed to `#/media-preview?src=...`. No lightweight entry, no second
HTML, no second `vite.config.ts` input. The single-entry build stays
single-entry. The webview inside the warm window is the same SPA — Vue,
Pinia, Apollo, i18n, router — the lot. We are not shrinking the JS; we
are eliminating the per-click window-construction + JS-bootstrap cost.

The implication: when the warm window parks itself, it has already
loaded the full SPA bundle once. **Refill must reuse the same code
path**, otherwise we double the cold-start cost by also preloading
half-the-app on every refill.

## Implementation Details

### 1. Rust pool module ✅

- `src-tauri/src/commands/media_preview_pool.rs` — Full implementation:
  - `MediaPreviewState` with `warm_label: Mutex<Option<String>>`
  - `init(app)` — builds the warm hidden window on startup
  - `activate(app, source)` — promotes warm window to visible or falls back to new window
  - `on_window_destroyed(app, label)` — rebuilds warm pool after any preview window closes
  - Tauri commands: `media_preview_init`, `media_preview_activate`
- Registered in `lib.rs` via `app.manage(MediaPreviewState::default())`
- `on_window_event` (Destroyed) hook triggers pool rebuild

### 2. Frontend bridge ✅

- `src/lib/api/tauri-window.ts` — `openMediaInWindow()` now calls
  `media_preview_activate` instead of `openWindow` for media preview
  paths
- `src/main.ts` — calls `media_preview_init` on app startup

### 3. Lifecycle wiring ✅

- Init runs at app startup via `main.ts`
- Window destruction triggers pool rebuild via `on_window_event`

### 4. Source switching ✅

- `navigate_and_show()` uses `window.location.replace()` to switch
  the warm window's URL without a full reload, preserving the
  "native feel" — no flicker, no extra IPC roundtrip

## Out of scope (intentionally)

- Lightweight entry point / per-route bundle split. The pool doesn't need
  a smaller JS payload — it just needs the window pre-built. Bundle
  splitting for the preview route is a separate, orthogonal
  optimization and lives in a follow-up doc.
- macOS Quick Look–style thumbnail-to-fullscreen animation. That needs a
  native `NSView` bridge. Mentioned in chat; not part of this plan.
- Multi-window concurrent previews. The design supports it (the pool is
  replaceable with a `Vec<WebviewWindow>`), but the user explicitly
  asked for the single-slot model.
- Generic window pre-warm for other routes (`/messages`, `/notes`, …).
  Same pattern would apply, but scope-creep — keep for a follow-up.

## Open questions

None. Defaults: always-warm pool, always-1, fallback kept, source
re-swap inside the visible window via `set_url`, init runs 2s after
main mount, refill runs on a detached task so the click thread never
waits.
