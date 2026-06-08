# media-preview warm pool plan

> Goal: make `/media-preview` sub-window open with native-app feel — no blank
> flash. The current path spins up a brand-new `WebviewWindow` per click
> (`WebviewWindowBuilder::new(...).build()` in `commands/window.rs::create_window`),
> which has to allocate the native window, load `dist/index.html`, parse
> the SPA entry, bootstrap Vue/Pinia/Apollo/i18n, and finally let the
> router resolve `/media-preview` before `MediaPreviewView` mounts.
>
> We replace the "build a new window each time" model with a single
> always-warm hidden window that the Rust side **promotes to visible on
> demand**. The webview inside is a normal SPA webview — we just pay the
> cold-start cost once, then reuse.

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

## Sub-tasks

### 1. Rust pool module

- [ ] New file `src-tauri/src/commands/media_preview_pool.rs` with:
      - `pub struct MediaPreviewPool(Mutex<Option<WebviewWindow>>)` (or
        `tokio::sync::Mutex` — pick based on what's already idiomatic in
        this codebase; check existing `manage()`-ed state).
      - `init(app: &AppHandle)` — build the warm hidden window if absent.
        Idempotent.
      - `activate(app: &AppHandle, source: ISource) -> ActivateResult` —
        returns one of `PoolPromoted(label)` / `ReusedVisible(label)` /
        `Fallback(path)`. Internally: if a visible window with the same
        label exists, focus + `set_url(...)`; else if pool is full, take
        from pool + `show()` + `set_focus()` and spawn a refill task;
        else fall back to `create_window("/media-preview?<source>")`.
      - `release(app: &AppHandle, label: &str)` — destroy a visible
        window by label. Idempotent. Does **not** touch the pool (the
        refill step is what keeps the pool warm).
      - All public fns log at info level on success, error level on
        failure.
- [ ] Register the pool in `lib.rs` via
      `app.manage(MediaPreviewPool::default())` (after the existing
      `manage()` calls).
- [ ] New Tauri commands:
      - `#[tauri::command] media_preview_init(app: AppHandle)`
      - `#[tauri::command] media_preview_activate(app: AppHandle, source: serde_json::Value) -> String`
        — returns the label it used (so the caller can log it).
      - `#[tauri::command] media_preview_release(app: AppHandle, label: String)`
- [ ] Add `media_preview_pool` to the `mod commands;` tree in `lib.rs`.
- [ ] Verify: `cargo check` clean; `cargo test` clean (no new tests
      required, but the existing suite must stay green).

### 2. Frontend bridge

- [ ] New file `src/lib/api/media-preview.ts` exporting:
      - `initPool(): Promise<void>` — invokes `media_preview_init`,
        idempotent, safe to call multiple times.
      - `activatePreview(source: ISource): Promise<void>` — invokes
        `media_preview_activate` with the source. Passes the URL the
        warm window should point at (Rust constructs it from the source
        fields, matching what `openMediaInWindow` does today).
      - `releasePreview(label: string): Promise<void>` — invokes
        `media_preview_release`.
- [ ] Replace the `openWindow("/media-preview?...")` call inside
      `openMediaInWindow` in `src/lib/api/tauri-window.ts` with
      `activatePreview(source)`. Keep `openWindow` for the macOS dock
      "New Window" / fallback paths. Delete `openMediaInWindow` once
      this swap is in — its only caller is `useOpenMedia`, and the new
      `activatePreview` covers it cleanly.
- [ ] `MediaPreviewView.vue` stays exactly as it is today: it reads
      `?src=…` / `?name=…` / `?path=…` from `window.location.search`
      inside `onMounted`. The warm window just points at the same URL
      shape. **No code change in the SPA** for the pool to work.

### 3. Lifecycle wiring on the main window

- [ ] In `src/main.ts` (or a new `src/plugins/warm-pool.ts` called from
      there), 2 seconds after `mount()` succeeds, call `initPool()`.
      Use `setTimeout(..., 2000)` wrapped in a try/catch so a failure
      never blocks app start.
- [ ] In `MediaPreviewView.vue` `onBeforeUnmount`, if we are the only
      lightbox source, call `releasePreview(label)` with the label that
      the main window received from `activatePreview`. (Track the label
      in `tempStore.lightbox` or pass it via a small per-window module
      variable — decide on the lighter of the two.)
- [ ] Verify by opening then closing the preview 10 times in a row;
      no `cargo run --release` memory growth beyond ~50MB steady state
      (one pool window + the active one during use, then back to one).

### 4. Performance measurement (verification)

- [ ] Build before changes: capture the time from
      `invoke('open_window', '/media-preview?...')` returning to the
      `<img>` `onload` event firing, average over 5 trials. Use a
      `console.time`/`console.timeEnd` around the open + a
      `performance.mark` in `MediaPreviewView.vue` `onMounted`.
- [ ] Apply changes, re-measure with the same harness.
- [ ] Document both numbers in a "Results" section at the bottom of this
      file.
- [ ] If the new number is not at least **2×** faster on the 2nd-and-later
      activations, do not merge — re-investigate (likely the warm window
      is being destroyed somewhere it shouldn't be, or the warm window's
      webview state is being reset on `set_url`).

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
