# Per-window identity & cross-window sync

## Identity model

Two values, layered:

| Value | Source | Scope | Meaning |
|---|---|---|---|
| `desktopClientId` | `prefs.client_id` (Rust `ensure_identity`) | Tauri install | Desktop app's stable id, shared by every webview |
| `boundClientId` | `sessionStorage['__bound_client_id__']` | Webview/tab | Android device this window is talking to. `''` = local mode |

```
getWindowClientId() = boundClientId || desktopClientId
isLocalMode()       = !boundClientId
```

Local mode is the absence of a binding — no sentinel string. The desktop id is what local mode actually uses, so two local-mode windows sync with each other (they share the same effective clientId).

## Where the binding comes from

Three sources, in priority order:

1. `?__cid=...` query param at launch. `openWindow(path)` in `lib/api/tauri-window.ts` auto-appends `?__cid=<getWindowClientId()>`. The child's `main.ts` calls `applyUrlClientId()` before pinia exists.
2. `useDeviceSessionsStore.setCurrent(deviceId)` (or `setBoundClientId`). Called from the device switcher modal / tab bar when the user picks a device. Reload after.
3. Default: desktop id (local mode).

## Cross-window sync

`defineCrossWindowStore` factory in `lib/cross-window-store.ts`:

```ts
export const useTempStore = defineCrossWindowStore<'temp', TempState>('temp', {
  state: () => ({ /* ... */ } as TempState),
}, {
  syncKeys: ['counter', 'audioPlaying', 'feedsSyncing'],
})
```

Wires automatically:

- `$subscribe` broadcasts `{ windowId, clientId, patch }` over `BroadcastChannel('plain-web:store:<id>')` — only the declared keys.
- Receiver runs `$patch(patch)`. A `__cw_replaying` flag (cleared via `queueMicrotask`) prevents the receiver from echoing back.

Receiver filter:

```
if (msg.windowId === getWindowId())          drop   // self-echo
if (msg.clientId !== getWindowClientId())    drop   // different identity
else                                         deliver
```

Practical: two windows bound to the same device sync. A window on device A ignores messages from device B. Local-mode windows sync with each other (they all share the desktop id).

## Caveats

- **Structured clone**: `syncKeys` values must be JSON-friendly. No `Uint8Array`, `File`, `Set`, `Map`, functions, or reactive proxies. (`temp` already excludes those.)
- **No late-join snapshot**: BroadcastChannel is fire-and-forget. Persistent state belongs in `prefs` / `localStorage`, not in a cross-window store.
- **`main` store is not wired**: persistent bits are deliberately per-device via `getMainStateKey()`. UI bits (`tabs`, `activeTabId`) are per-window.
- **Don't manually `bus.publish(...)`**: the factory handles it. Just declare `syncKeys`.

## API

```ts
// window-client.ts
getDesktopClientId(): string
getBoundClientId(): string              // '' if local mode
setBoundClientId(id: string): void
clearBoundClientId(): void
getWindowClientId(): string             // boundClientId || desktopClientId
isLocalMode(): boolean
isLocalClientId(id: string): boolean
getWindowId(): string
applyUrlClientId(): void

// device-current.ts (stable shim; existing call sites unchanged)
getCurrentClientId(): string            // → getWindowClientId()
getCurrentDeviceHost(): string          // host of the bound session, '' if none
getCurrentAuthToken(): string           // token of the bound session, '' if none
getMainStateKey(): string               // 'main_state:<clientId>'
clearCurrentSession(): void             // clears token + drops binding

// device-sessions store
store.sessions: DeviceSession[]
store.currentClientId                  // getter → getWindowClientId()
store.currentSession                   // getter
store.setCurrent(clientId)             // '' → local mode, else bind
store.remove(clientId)                 // drops binding if it was active
```

## Migration notes

- The old `device_sessions.currentClientId` prefs field is gone. Old prefs files with that field are read fine (it's ignored); new writes only contain `sessions`.
- `LOCAL_CLIENT_ID = '__local__'` sentinel string is gone. To "switch to local mode" call `setCurrent('')` (which `clearBoundClientId()`s).
- Rust side untouched. `prefs::ensure_identity` still writes `client_id` on first launch.

## File map

| File | Role |
|---|---|
| `src-tauri/src/prefs.rs::ensure_identity` | Creates `client_id` (Rust) |
| `src/lib/prefs.ts::preload` | Hydrates prefs cache so `prefsGet('client_id')` is sync |
| `src/main.ts::applyUrlClientId()` | Pulls `?__cid=` into sessionStorage at bootstrap |
| `src/lib/window-client.ts` | `getBoundClientId` / `getDesktopClientId` / `getWindowClientId` / `isLocalMode` |
| `src/lib/device-current.ts` | Stable shim: `getCurrentClientId`, `isLocalMode`, `getCurrentDeviceHost`, `getCurrentAuthToken`, `getMainStateKey`, `clearCurrentSession` |
| `src/stores/device-sessions.ts` | Persistent sessions list + binding actions; `currentClientId` is a getter |
| `src/lib/cross-window-store.ts` | `defineCrossWindowStore` Pinia factory |
| `src/stores/temp.ts` | Example consumer: `syncKeys: ['counter', 'audioPlaying', 'feedsSyncing']` |
| `src/lib/api/tauri-window.ts::openWindow` | Auto-appends `?__cid=<getWindowClientId()>` |
| `src/components/DeviceSwitcherModal.vue` / `TauriTabBar.vue` / `App.vue` | UI bindings |