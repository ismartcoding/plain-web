# DONE.md — Completed Task History

> This file records all completed translation and development tasks with
> timestamps for traceability. Append new entries to the bottom.
>
> Format: `### YYYY-MM-DD HH:MM (TZ) — Task Title`

---

### 2026-08-14 ~02:00 (Asia/Shanghai) — Channel key encryption fix

**Problem:** Sending messages to a channel in plain-web always failed when
not the channel owner. Non-owners lacked channel key cache, leading to
fallback to peer key encryption while still including `c-cid` header,
causing decryption failure on plain-app.

**Files modified:**
- `local/channel/handler.rs` — `load_key_cache` after invite acceptance
- `local/channel/chat_helper.rs` — removed peer key fallback in `send_async`
- `local/peer_graphql/auth.rs` — enforced channel key decryption with `c-cid`
- `local/graphql/schema/chat_message.rs` — pre-send key cache load
- `local/graphql/schema/chat_channel.rs` — cache refresh on invite acceptance

**Result:** `c-cid` header now strictly indicates channel key encryption
with no fallback, aligning with plain-app's logic. `cargo check` passed.

---

### 2026-08-17 (Asia/Shanghai) — Fix re-discovery after a device's IP changes

**Problem:** After a phone (e.g. p9, id `1xvuvk3ujzxyn`) changed its IP on
the LAN, the desktop app could not reconnect: it kept failing against the
stale IP in the DB and never picked up the new one, even after restarting
the app.

**Root cause (two bugs in the mDNS-directed re-discovery path):**
- `mdns/service_browser.rs` — the `TYPE_A` handler called `ips.insert(ip)`
  so a host's old IP was never removed. After an IP change the stale
  address remained in the set, sorted first, and `DPeer::best_ip()` kept
  targeting the dead IP forever even when the new A record arrived.
- `NearbyDiscoverManager::browse()` — it only sent a one-shot PTR query.
  That query's response is only parsed by `handle_packet`, which runs as a
  packet listener that exists only while the mDNS browser is running. The
  browser is NOT started at app boot (only the responder socket via
  `discover_mgr.start()`), so reconnects/failed-sends never consumed the
  reply and the closed peer's IP was never refreshed.

**Files modified:**
- `commands/discover/mdns/service_browser.rs` — `TYPE_A` handler now clears
  the instance IP set before inserting the current address.
- `commands/discover/NearbyDiscoverManager.rs` — `browse()` now ensures the
  host responder and the mDNS browser (packet listener) are running before
  sending the directed PTR query.
- `commands/discover/mdns/service_browser.rs` — added unit test
  `a_record_replaces_stale_ip_instead_of_accumulating`.

**Result:** `cargo test --lib discover` — 7 passed, 0 failed (incl. new
test). Compile clean.

---

### 2026-08-17 (Asia/Shanghai) — Resident mDNS listening, scan gated by page (plain-desktop + plain-app)

**Problem:** The mDNS browser coupled passive packet listening (which
refreshes paired peers' IPs) with the 5 s periodic PTR scan loop.
`stopDiscovery` (leaving the nearby page) removed the packet listener and
wiped instance state, so IP refresh died with the page — the root cause of
the previous bug's "directed browse has no one to parse the reply" symptom.

**Fix — passive listening resident, active scanning page-gated:**
- Listener installed once at app start (`lib.rs` boot path →
  `NearbyDiscoverManager::start` → `browser.install_listener`) and never
  removed; instance cache survives `stop()`.
- `stop()` now aborts the scan loop only; removed the then-dead
  `host_responder::remove_packet_listener`.
- `on_device_found` always refreshes a paired peer's DB row; nearby-list
  events (`WS_NEARBY_DEVICE_FOUND`, seen-in-session, set_online) fire only
  while the scan loop runs. `browse()` (directed re-discovery) needs no loop.
- Same fixes applied to plain-app Kotlin (`MdnsServiceBrowser.kt`,
  `MdnsDiscoverManager.startReceiver`, removed
  `MdnsHostResponder.removePacketListener`): `ips + ip` → `setOf(ip)` A-record
  replacement, resident `ensureListening()` at boot, `stop()` keeps
  listener/state, `emitDevice` gates nearby UI events on `isRunning`.

**Files modified:**
- plain-desktop: `commands/discover/mdns/service_browser.rs`,
  `commands/discover/NearbyDiscoverManager.rs`,
  `commands/discover/mdns/host_responder.rs`
- plain-app: `shared/.../mdns/MdnsServiceBrowser.kt`,
  `shared/.../mdns/MdnsHostResponder.kt`,
  `shared/.../discover/MdnsDiscoverManager.kt`

**Result:** `cargo test --lib discover` — 8 passed, 0 failed (added
`stop_keeps_instance_state_for_resident_listening`). Kotlin metadata compile:
mDNS sources clean; the single `Database.kt` error pre-exists on a clean
tree (verified via stash).

---

### 2026-08-17 (Asia/Shanghai) — Stale login-session host + upsert spam fix

**Problem:**
1. Remote-login session host (`device_sessions` in prefs, e.g.
   `192.168.123.15:8443`) never updated when the phone changed IP, so the
   desktop kept dialing the dead host. The self-heal in
   `app-socket.ts:triggerDiscovery` was defeated by the (now fixed) stale-IP
   accumulation: `match.ips[0]` after sorting was the OLD IP, so `newHost ===
   currentHost` always short-circuited. It also wrote prefs directly,
   leaving the Pinia store (tab bar / login host display) stale.
2. `upsert_peer` fired on every mDNS announcement (≈14×/s bursts): resident
   listening re-emits complete instances per packet and
   `update_known_peer` wrote unconditionally.

**Fix:**
- `app-socket.ts` — `triggerDiscovery` now routes through
  `useDeviceSessionsStore().updateHost` (persist + in-memory state).
  Correct new-IP pick-up relies on the A-record replacement fix (ips now
  hold only the fresh address).
- `NearbyDiscoverManager::update_known_peer` — skip the write when
  name/ip/port/device_type are unchanged; upsert only on real changes.
- plain-app `PeerManager.applyDeviceDiscovered` — same content-compare
  early-return (its `PeerCacher.mutatePeer` also wrote every announcement).

Trade-off (both sides): a directed-browse reply with unchanged data no
longer bumps `updatedAt`, so `reconnectPeer` treats it as "no reply" and
reschedules with backoff — retrying the same unchanged address is the only
option anyway.

**Files modified:**
- `src/hooks/app-socket.ts`
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs`
- plain-app `shared/.../chat/peer/PeerManager.kt`

**Result:** `cargo test --lib discover` 8/8; `yarn typecheck` clean.

---

### 2026-08-17 (Asia/Shanghai) — device_sessions host never healed (peers fresh, sessions stale)

**Problem:** After a phone IP change the peers table got the new IP
(passive path: the phone's mDNS announcements reach the desktop on every
joined interface → resident listener → `update_known_peer`), but the
frontend login-session host in `device_sessions` (prefs.json) never
updated. Root causes in the ACTIVE path (`triggerDiscovery` →
`discover_devices` → outgoing PTR query → reply):

1. `host_responder::send_query` set the multicast egress interface to only
   the FIRST candidate interface. On a Mac with several interfaces
   (Ethernet/VM bridge/utun enumerated before Wi-Fi) the PTR query left the
   wrong NIC — the phone never heard it, no reply came. This also explains
   the original "doesn't even send mDNS queries" observation.
2. `discover_devices` never cleared `seen_in_session`, so the one-shot scan
   returned the STALE entry from an earlier scan (old IP). Frontend:
   `newHost === currentHost` → early return → never healed.
3. The healing path depended entirely on that fragile multicast round-trip.

**Fix:**
- `host_responder::send_query` — send the query once per candidate
  interface (egress iface is a socket-wide setting; single send can only
  leave one NIC). Single send fallback when no candidates.
- `discover_devices` — clear `seen_in_session` before the PTR query so a
  one-shot scan reflects only what THIS scan hears.
- New Tauri command `peer_address(id)` — returns the paired peer's current
  `ip:port` straight from the peers table (kept fresh by the passive
  resident listener).
- `app-socket.ts:triggerDiscovery` — fast path via `peer_address` (no
  network needed); falls back to the active `discover_devices` scan.
- plain-app `MdnsHostResponder.sendQuery` — same per-interface loop.

**Files modified:**
- `src-tauri/src/commands/discover/mdns/host_responder.rs`
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs`
- `src-tauri/src/commands/discover/mod.rs`, `src-tauri/src/lib.rs` (command)
- `src/hooks/app-socket.ts`
- plain-app `shared/.../mdns/MdnsHostResponder.kt`

**Result:** `cargo test --lib discover` 8/8; clippy clean; `yarn
typecheck` clean.

---

### 2026-08-17 (Asia/Shanghai) — Centralized device-host updates (peers + device_sessions)

**Problem:** IP-change healing logic was scattered — the frontend hook
(`app-socket.ts:triggerDiscovery`) both discovered and rewrote session
hosts, while the WS proxy dialed a URL built from the possibly-stale
session host. device_sessions (the registry of managed remote phones, all
features) had no dedicated update path.

**Design:** peers table is the single persisted client_id → ip:port center
(fresh via the resident mDNS listener). One write point, one event, one
resolve:

- Write point (unchanged, already change-gated): `update_known_peer`
  upserts peers only when name/ip/port/device_type actually changed.
- NEW: on that change branch it also emits the Tauri event
  `device-host-changed { clientId, host }` straight to the webview (same
  channel pattern as `pairing-event`; independent of the device WS, so it
  works exactly when the WS is down due to the IP change).
- Frontend: `app-socket.ts` listens once →
  `deviceSessions.updateHost` (persist; skips when host unchanged). All
  device_sessions consumers (login list, tab bar, future dials) see the
  fresh host.
- Dialing: `TauriWebSocket(url, clientId)` re-resolves the URL authority
  from the peers table (`peer_address` command) right before connecting —
  every reconnect naturally uses the freshest address. Removed
  `triggerDiscovery` (~-45 lines) and its retry-time invocation.

**Files modified:**
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs`
  (`set_app_handle`, emit in change branch)
- `src-tauri/src/lib.rs` (inject app handle)
- `src/lib/api/tauri-ws.ts` (clientId-aware URL resolve)
- `src/hooks/app-socket.ts` (listen `device-host-changed`; pass clientId)
- `src/stores/device-sessions.ts` (`updateHost` skips unchanged)

**Result:** `cargo test --lib discover` 8/8; `yarn typecheck` clean; the
5 lint findings are pre-existing in unrelated files.

---

### 2026-08-14 ~18:00 (Asia/Shanghai) — Fix getLatestChatPreview returning empty

**Problem:** `getLatestChatPreview` in local mode always returned empty.
Root cause: SQL ambiguous column name in `get_all_latest_chats()` — the
`SELECT id,from_id,to_id,...` conflicted with the `latest` subquery's
`from_id`/`to_id`/`channel_id` columns, causing SQLite to error and
return empty results.

**Files modified:**
- `local/db/chat.rs` — Fixed SQL by qualifying all columns with `c.` prefix
  (`SELECT c.id,c.from_id,c.to_id,...`). Added error logging. Cleaned up
  debug test code. Added 3 unit tests for `get_all_latest_chats`.

**Result:** All 8 chat DB tests pass. Query now correctly returns the
latest chat per conversation.

---

### 2026-08-14 ~18:15 (Asia/Shanghai) — Translate ChatCacher.kt to Rust

**Task:** Direct translation of plain-app `ChatCacher.kt` to Rust,
maintaining file structure consistency.

**Files created:**
- `local/chat_cacher.rs` — Full translation of `ChatCacher.kt`:
  - `latest_chat_map: RwLock<HashMap<String, DChat>>` ↔ `MutableStateFlow<Map<String, DChat>>`
  - `get_latest_chat(chat_id)` ↔ `getLatestChat(chatId)`
  - `load(db)` ↔ `load()` — groups latest chats by conversation ID
    (channel/peer/"local"), keeps most recently updated per conversation

**Files modified:**
- `local/db/channel.rs` — Added `get_all_channels()` matching Kotlin's
  `chatChannelDao().getAll()`
- `local.rs` — Added `pub mod chat_cacher;`
- `local/graphql/context.rs` — Added `chat_cacher: Arc<ChatCacher>` field
  to `AppCtx`
- `local/server/mod.rs` — Initialize `ChatCacher` at server startup with
  `chat_cacher.load(&db)`

**Tests:** 5 ChatCacher unit tests (local/peer/channel/unknown/most-recent).
Full suite: 83 tests pass, 0 failures.

---

### 2026-08-14 ~18:30 (Asia/Shanghai) — Create translation progress documentation

**Task:** Document the full translation progress from plain-app Kotlin to
plain-web Rust, create DONE.md/TODO.md tracking files, and update AGENTS.md
with documentation practice rules.

**Files created:**
- `docs/TRANSLATION_PROGRESS.md` — Full mapping of ~195 Kotlin files to
  Rust counterparts with status indicators (✅/⚠️/❌/N/A)
- `DONE.md` — This file, recording completed tasks with timestamps
- `TODO.md` — Pending translation and development tasks

**Files modified:**
- `AGENTS.md` — Added "Task tracking & documentation" section with rules
  for updating DONE.md and TODO.md on every task

**Result:** Translation coverage: ~56% fully translated, ~58% including
partials. 33 items identified as not-yet-translated (excluding N/A).

---

### 2026-08-14 ~19:00 (Asia/Shanghai) — Complete High Priority Core Chat Features

**Task:** Resolve the three High Priority items from TODO.md.

**Task 1 — insertFilesImmediate / updateFilesMessage:**
Already handled. The frontend uses upload-then-sendChatItem pattern.
The Rust `send_chat_item` mutation already supports IMAGES/FILES content
types via `to_peer_content` (converts `fid:` to `fsid:` for peer delivery).
No code changes needed.

**Task 2 — HttpServerSessions / SessionList:**
N/A for local mode. The Tauri desktop app runs the server locally;
multi-client session tracking is not needed.

**Task 3 — SystemRoutes (/init endpoint):**
**Files modified:**
- `local/server/http_handler.rs` — Implemented `/init` endpoint:
  - If body decrypts with URL token → return empty body (frontend
    auto-logins via `finishLoginSuccess()`)
  - If no body or decryption fails → return
    `InitResponse(signaturePublicKey)` as JSON, where the key is the
    Ed25519 verifying key (last 32 bytes of the 64-byte keypair)
  - Added imports: `AsyncReadExt`, `base64_decode`, `base64_encode`

**Result:** `cargo check` passes. 83 tests pass, 0 failures.

---

### 2026-08-14 ~22:00 (Asia/Shanghai) — Complete DownloadStatus enum translation

**Task:** Audit and align Rust `DownloadStatus` enum with plain-app's
Kotlin `DownloadStatus.kt`. The enum was half-translated — all 6 variants
(PENDING, DOWNLOADING, PAUSED, COMPLETED, FAILED, CANCELED) were present
and correct, but the standard trait implementations were missing.

**Files modified:**
- `src-tauri/src/local/enums.rs` — Completed `DownloadStatus` to match
  the convention used by every other enum in the file:
  - Added `Enum` derive from `async_graphql` + `#[graphql(name = ..., rename_items = "SCREAMING_SNAKE_CASE")]`
  - Added `ToSql` impl (stores as `Value::Text(self.to_string())`)
  - Added `FromSql` impl (parses via `FromStr`)

**Result:** `cargo check` passes (exit code 0). `DownloadStatus` now has
the complete trait set (`Enum` + `Display` + `FromStr` + `ToSql` +
`FromSql`) consistent with `PeerStatus`, `ChatStatus`, `ChannelStatus`,
etc. Task tracking updated: removed from `TODO.md`, marked ✅ in
`docs/TRANSLATION_PROGRESS.md`.

---

### 2026-08-14 ~19:00 (Asia/Shanghai) — Fix Windows/Linux CI build + add cross-platform check

**Problem:** The release workflow's Windows job failed to compile:
- `title_bar_style` is a macOS-only `WebviewWindowBuilder` method (E0599)
- `BatteryHealth/BatteryPlugged/BatteryStatus` unused on non-macOS
- unused `target`/`window`/`name`/`buf` and a redundant `mut` on Windows

**Files modified:**
- `src-tauri/src/commands/media_preview_pool.rs` — gated `.title_bar_style`
  behind `#[cfg(target_os = "macos")]` (warm + fallback windows)
- `src-tauri/src/commands/window.rs` — gated `.title_bar_style` behind
  `#[cfg(target_os = "macos")]` (create_window + new_window); prefixed
  `set_window_device_name` params with `_` (macOS-only body)
- `src-tauri/src/local/graphql/schema/app.rs` — gated battery enum imports
  behind `#[cfg(target_os = "macos")]` (only used by `macos_battery`)
- `src-tauri/src/crypto/mod.rs` — renamed `buf`→`_buf`, moved
  `use std::io::Read` inside `#[cfg(unix)]`
- `src-tauri/src/local/server/mod.rs` — removed redundant `mut`

**Files created:**
- `.github/workflows/check.yml` — lightweight `cargo check` job on
  macos/windows/linux, triggered on push to main and PRs, so all three
  platforms' cfg paths are verified on every push (Linux installs the same
  webkit/gtk deps as the release workflow).

**Result:** `cargo check` and `cargo clippy` pass on macOS. All reported
Windows/Linux errors and warnings are resolved.

---

### 2026-08-15 ~15:50 (Asia/Shanghai) — Sync plain-app "refactor scan/pairing flow" (mDNS + HTTPS pairing)

**Task:** Sync plain-app commit `56dc88a` ("refactor scan/pairing flow")
to plain-web. LAN discovery moved from custom UDP multicast
(`224.0.0.100:52352`) to standard mDNS (`_plainapp._tcp.local`);
pairing transport moved from UDP unicast to HTTPS `POST /nearby`.
Kotlin logic translated directly to Rust. (A follow-up upstream commit
`d156619` "Enhance ble chat" only touches `AndroidBleGattClient.kt` —
Android-only BLE platform code, N/A for desktop.)

**Files created:**
- `src-tauri/src/commands/discover/mdns/` — full mDNS module:
  - `packet_codec.rs` ← `MdnsPacketCodec.kt` (DNS parse/build, name
    compression, A-record responses)
  - `host_responder.rs` ← `MdnsHostResponder.kt` (shared 5353 socket,
    hostname A responder, `getBestIp` subnet match)
  - `service_browser.rs` ← `MdnsServiceBrowser.kt` (PTR/SRV/TXT/A
    aggregation, goodbye handling, expiry, `snapshot()` debug surface)
  - `service_info.rs` ← `MdnsServiceInfo.kt` (TXT records: id/name/
    version/platform/port)
  - `service_response_builder.rs` ← `MdnsServiceResponseBuilder.kt`

**Files modified:**
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs` ←
  `MdnsDiscoverManager.kt` — browser lifecycle, one-shot
  `discover_devices` scan (2.5s window), WS events
- `src-tauri/src/local/pairing/{mod,protocol,utils,commands}.rs` ←
  `PairingInitiator/Responder/Messenger/Core.kt` +
  `NearbyHttpClient.kt` — ECDH + Ed25519 handshake over HTTPS
  `/nearby`; removed `is_qr_initiated`, added `aware_supported`/`from_ip`
- `src-tauri/src/local/server/http_handler.rs` — added `POST /nearby`
  route (← `NearbyRoutes.kt`)
- `src-tauri/src/local/server/{mod,plain_conn,tls_conn}.rs` — publish
  mDNS service on HTTPS bind; pass client IP for `from_ip` stamping
- `src-tauri/src/local/graphql/schema/pairing.rs` — `PairingDeviceInput`
  uses `discover_get_best_ip(&input.ips)` as POST target
- `src-tauri/src/lib.rs` — event bridge for `PairingEventKind::Started`
- `src-tauri/src/commands/discover/{mod,PeerStatusManager}.rs` — module
  re-exports, peer status sync
- `src/views/login/DiscoverySection.vue` — device host now
  `ips[0]:port` (mDNS carries IPs; `host` field removed upstream)
- `tests/lib/chat-cacher.test.ts` — removed stale `getChatPreview` import
- `docs/TRANSLATION_PROGRESS.md` — added mDNS/discover section

**Result:** `cargo check` clean; `cargo test` 145 passed / 0 failed.
`yarn typecheck` clean; `yarn test` 406 passed (51 integration-test
failures are ECONNREFUSED — they require a live server on :8080).
Frontend/backend types aligned (`DiscoveredDevice`,
`PairingDeviceInput`).


---

### 2026-08-15 17:05 (Asia/Shanghai) — Fix text-file window falling back to localhost in Tauri remote mode

**Problem:** Logged into a Pixel 7 (remote mode), clicking a txt file in
Chat opened a text-file window whose `/fs` request went to
`http://localhost:8080` and failed with 401. Root cause: the child window
spawned by `openWindow` carries `?__cid=<device-id>`, but `main.ts` ran
`applyUrlClientId()` at module top-level — BEFORE `preloadPrefs()` populated
the Tauri plugin-store cache. `isLocalClientId()` then read the desktop
`client_id` as `''`, misclassified the device binding as local, stripped
`__cid`, and the window started in local mode: `getApiBaseUrl()` returned
the local server, whose `/fs` cannot decrypt a device-encrypted id → 401.

**Files modified:**
- `src/main.ts` — moved `applyUrlClientId()` after `preloadPrefs()` in the
  Tauri bootstrap; web mode applies it immediately (localStorage is sync).
- `tests/lib/window-client.test.ts` — regression test documenting the
  contract: `applyUrlClientId` drops a device `__cid` while the desktop
  `client_id` is unloaded, hence the bootstrap ordering requirement.

**Result:** Child windows inherit the device binding correctly; `/fs`
requests target the bound device host. `yarn vitest run
tests/lib/window-client.test.ts` 10/10 passed; `yarn typecheck` and ESLint
clean.

---

### 2026-08-15 17:20 (Asia/Shanghai) — Route text-file /fs through local HTTP proxy (self-signed cert)

**Problem:** Even with the child window correctly bound to the device
(previous fix), opening a txt file from Chat in remote mode still failed:
text-file.ts fetched `${getApiBaseUrl()}/fs?id=…` directly, i.e.
`https://<device>/fs`, which the Tauri webview rejects because the
device's local server uses a self-signed HTTPS cert.

**Fix:** text-file.ts now fetches via `getProxyUrl()` instead of
`getApiBaseUrl()`. `getProxyUrl` routes the request through the local
HTTP reverse proxy (`http://127.0.0.1:<proxyPort>/fs?...&_pt=<device>`),
whose Rust reqwest client accepts invalid certs — the same mechanism chat
images already use (`getFileUrl` → `getProxyUrl`). The proxy forwards the
response headers (content-disposition, content-length, last-modified) the
viewer reads.

**Files modified:**
- `src/views/text-file/text-file.ts` — use `getProxyUrl` for the `/fs`
  content fetch; drop now-unused `getApiBaseUrl` import.

**Result:** `yarn typecheck` clean. (ESLint still reports a pre-existing
`no-empty` on the `JSON.parse` catch at line 118 — unrelated to this
change.)

---

### 2026-08-15 21:30 (Asia/Shanghai) — DeviceInfoView: mDNS debug card → modal + fix stale mDNS snapshot

**Task:** Hide the inline mDNS debug card in DeviceInfoView, expose it via a
modal button next to the mDNS edit button, extract all inline modals into
separate files, and fix mDNS debug info not updating after a hostname change
(even on refresh — stale browser cache).

**Files created:**
- `src/views/device-info/MdnsDebugModal.vue` — mDNS debug info modal
  (previously the inline debug card). Owns its browse lifecycle: starts
  periodic discovery + 2s snapshot refresh on mount, stops on close.
- `src/views/device-info/MdnsHostnameDialog.vue` — mDNS hostname edit dialog
  (extracted from inline modal).
- `src/views/device-info/PortEditDialog.vue` — HTTP/HTTPS port edit dialog
  (extracted from inline modal).

**Files modified:**
- `src/views/device-info/DeviceInfoView.vue` — removed the mDNS debug card
  and all inline `<v-modal>` blocks; added a bug-report icon button after the
  mDNS edit button that opens `MdnsDebugModal` via `openModal`; moved unused
  styles into the modal components.
- `src/views/device-info/use-mdns.ts` — `saveHostname` returns `Promise<boolean>`
  and calls `refreshSnapshot()` after saving; exposed `refreshSnapshot`.
- `src/views/device-info/use-http-server.ts` — `savePort` returns
  `Promise<boolean>`; removed unused `saving` from the return.
- `src-tauri/src/commands/discover/mdns/service_browser.rs` — added
  `clear_instances()` (drops accumulated instance state) + unit test
  `clear_instances_resets_accumulated_state`.
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs` —
  `set_mdns_hostname` now calls `browser.clear_instances()` +
  `browser.send_ptr_query()` so the snapshot re-discovers instances under the
  new hostname instead of returning cached ones.

**Result:** `cargo check` clean; `cargo test` 146 passed / 0 failed;
`yarn typecheck` clean. Editing the mDNS hostname now clears the backend
browser cache and re-queries, so the debug modal shows fresh data.

### 2026-08-15 23:37 (Asia/Shanghai) — Fix macOS DMG signing "no identity found" in release workflow

**Problem/Task:** The Release workflow's `Notarize and staple macOS DMG` step
failed with `***: no identity found` from `xcrun codesign`. Root cause: no
workflow step ever imported `APPLE_CERTIFICATE` into the runner keychain —
`tauri build` signs via its own temporary keychain that is destroyed when
bundling finishes, so the later manual `codesign --sign "$APPLE_SIGNING_IDENTITY"`
found no identity.

**Files modified:**
- `.github/workflows/release.yml` — added `Import macOS signing certificate`
  step (decode base64 p12 → create/unlock `$RUNNER_TEMP/app-signing.keychain-db`
  → `security import` → add to keychain search list → set-key-partition-list →
  `security find-identity` sanity check) before `Build desktop app`; added
  `Cleanup macOS signing keychain` step (`always()`) to delete the keychain and
  cert file.

**Result:** Workflow YAML validated (`yaml.safe_load`). The manual DMG
codesign/notarize/staple steps can now resolve the identity from the imported
keychain; secrets never persist past job teardown.

### 2026-08-16 00:04 (Asia/Shanghai) — Fix spctl "Insufficient Context" false negative in release verify step

**Problem/Task:** After the keychain fix, the Release workflow's
`Verify macOS notarization` step failed with
`PlainApp_0.1.0_aarch64.dmg: rejected source=Insufficient Context` (exit 3)
from `spctl`, even though `xcrun stapler validate` passed (DMG correctly
notarized + stapled).

**Root cause (verified locally on macOS 26.5.2):** `spctl -a -t open` run
headless against a DMG — or against an app bundle without assessment context —
returns the false negative `source=Insufficient Context`. Control experiment
with a known notarized third-party app (Rectangle): without the context flag
spctl rejects it; with `--context context:primary-signature` it prints
`accepted, source=Notarized Developer ID`. The flag also makes genuinely
broken signatures report real errors instead of Insufficient Context.

**Files modified:**
- `.github/workflows/release.yml` —
  - `Verify macOS notarization` step now mounts each DMG with `hdiutil
    attach`, locates the inner `.app`, and runs
    `codesign --verify --deep --strict` plus
    `spctl -a -vv -t open --context context:primary-signature` against it
    (stapler validate on the DMG unchanged).
  - Moved `Collect artifacts` / `Upload platform artifacts` before the verify
    step so a failing verification still leaves downloadable artifacts for
    local debugging.

**Result:** Workflow YAML validated (`yaml.safe_load`). Local reproduction of
the exact verify commands against the ad-hoc local DMG and against Rectangle
confirmed both the failure mode and the fix.

### 2026-08-16 00:25 (Asia/Shanghai) — Build separate Intel and Apple Silicon macOS DMGs

**Problem/Task:** Release workflow only produced `aarch64` (Apple Silicon)
DMG. Required separate Intel (`x86_64`) and Apple Silicon (`aarch64`)
installers.

**Approach:** Cross-compile both architectures on the single `macos-latest`
(arm64) runner via `tauri build --target <triple>`. Verified feasibility
locally on macOS 26.5.2: `rustup target add x86_64-apple-darwin` then
`cargo check --target x86_64-apple-darwin` finished clean (exit 0, 5
warnings) — including `rusqlite` `bundled` SQLite C source cross-compiled
successfully.

**Files modified:**
- `build-desktop.sh` — on macOS, builds both
  `aarch64-apple-darwin` and `x86_64-apple-darwin` targets; other platforms
  unchanged.
- `.github/workflows/release.yml` —
  - Added `Add macOS Rust targets` step (`rustup target add
    aarch64-apple-darwin x86_64-apple-darwin`, macos only).
  - `Notarize and staple macOS DMG`, `Collect artifacts`, and
    `Verify macOS notarization` now glob both
    `target/{aarch64,x86_64}-apple-darwin/release/bundle/dmg/*.dmg`.
  - `Collect artifacts` names macOS outputs with an arch suffix
    (`PlainApp-<VERSION>-macos-aarch64.dmg` / `-x86_64.dmg`) by extracting
    the trailing arch from the Tauri DMG filename, so both artifacts coexist
    and still match the release `PlainApp-*` pattern.

**Result:** Workflow YAML validated (`yaml.safe_load`); shell script syntax
checked (`bash -n`). Cross-compilation of x86_64 confirmed locally. Release
now ships two architecture-specific DMGs.

### 2026-08-16 01:28 (Asia/Shanghai) — Fix macOS app killed at launch on macOS 15 (Runtime Version too new)

**Problem/Task:** Run 31895807216 was fully green, but both DMGs crashed at
launch on user Macs with `EXC_CRASH (SIGKILL (Code Signature Invalid))`,
`Termination Reason: CODESIGNING 1 Taskgated Invalid Signature` (Intel
MacBookPro 15.7.7 crash report provided; Apple Silicon Mac also failed).

**Root cause (verified by inspecting the actual CI artifacts):** `macos-latest`
is now a macOS 26 runner with Xcode 26 (SDK 26.5). The hardened-runtime
version stamped into the CodeDirectory is derived from the SDK used at link
time: both apps showed `Runtime Version=26.5.0` (binary `LC_BUILD_VERSION`:
minos 11.0, sdk 26.5). macOS kills any binary whose runtime version exceeds
the running OS version — so every Mac below 26.5 rejects it at dyld start,
regardless of the (otherwise perfectly valid, notarized, stapled) signature.
Runner-side `codesign --verify`/`spctl` all pass because the runner itself is
macOS 26. Not a dual-arch regression — every build since macos-latest became
26 has been affected; first time artifacts were runtime-tested on real Macs.

**Files modified:**
- `.github/workflows/release.yml` —
  - macOS matrix entry pinned to `macos-15` (default Xcode 16.4, macOS 15.5
    SDK → `Runtime Version=15.5.0`, runs on macOS 15.5+ and forward-compat
    with 26).
  - New `Select Xcode with macOS 15 SDK` step: picks the first installed
    Xcode whose macOS SDK is 15.x via `xcode-select`, hard-fails if none.
  - `Verify macOS notarization` step now asserts the mounted app's
    `Runtime Version` major ≤ 15 and fails with an explanatory error
    otherwise (regression guard against future SDK/runner drift).

**Result:** Workflow YAML validated (`yaml.safe_load`). macos-15 image
verified to ship Xcode 16.4 (SDK 15.5). Artifact-level signature inspection
of the broken run performed locally (stapler/codesign/spctl/otool) to
establish the evidence chain.

### 2026-08-16 01:52 (Asia/Shanghai) — Real root cause: restricted multicast entitlement killed app on every macOS

**Problem/Task:** Follow-up on the same launch failures: reproduced on the
local macOS 26.5.2 machine — `open` failed with
`Launchd job spawn failed (POSIX 163)` and direct exec was SIGKILLed
(exit 137). The previous Runtime Version diagnosis was wrong (26.5.2 ≥
26.5.0, runtime check passes; the macOS 15 crash report itself said
"Taskgated Invalid Signature").

**Root cause (from unified log on the 26.5.2 repro):**
`taskgated-helper: Disallowing com.ismartcoding.plain.desktop because no
eligible provisioning profiles found` →
`amfid: not valid Code=-413 "No matching profile found"` →
`kernel AMFI: Code has restricted entitlements, but the validation of its
code signature failed` → SIGKILL. The CI-signed app carried
`com.apple.developer.networking.multicast` (a restricted entitlement) from
`src-tauri/entitlements.plist` via `tauri.conf.json` macOS signing config.
Developer ID signatures cannot carry `com.apple.developer.*` entitlements
without an embedded provisioning profile — same kill on macOS 15 and 26.
Dev builds never hit it because `build.rs` ad-hoc signs (no team ID →
taskgated skips the profile check).

**Evidence the entitlement is unnecessary:** a plain unsigned Python process
on macOS 26.5.2 successfully sent and received UDP multicast to
224.0.0.251:5353 (the mDNS group) with SO_REUSEADDR/SO_REUSEPORT —
non-sandboxed macOS apps do not need the multicast entitlement (that is an
iOS / sandboxed-App-Store mechanism). The repo's mDNS sockets already set
SO_REUSEPORT + multicast loopback, which was the actual fix for the
historical "multicast probes silently dropped" issue.

**Files modified:**
- `src-tauri/entitlements.plist` — removed
  `com.apple.developer.networking.multicast`; kept
  `com.apple.security.network.client/server` and `app-sandbox=false`
  (non-restricted, harmless).
- `src-tauri/build.rs` — removed the debug-only ad-hoc signing helper whose
  only purpose was injecting the multicast entitlement; build script is now
  just `tauri_build::build()`.
- `.github/workflows/release.yml` — `Verify macOS notarization` now also
  asserts the app carries no `com.apple.developer.*` entitlements and fails
  with an explanatory error if it does (regression guard; macos-15 runner
  pin + Runtime Version guard from the previous entry retained as hygiene).

**Result:** Workflow YAML validated; `cargo check` clean (5 pre-existing
warnings). Local `yarn tauri build` + re-sign with the new plist produced a
signature containing only `app-sandbox/network.client/network.server` (zero
`com.apple.developer.*`), and the rebuilt binary executed past signature
validation into app code (panicked only on an unrelated local port-8080
conflict with a running `iosApp` dev server). Full confirmation requires the
next CI release run installed on the Intel (15.7.7) and Apple Silicon
machines.

---

### 2026-08-16 02:30 (Asia/Shanghai) — Add About menu and Check for Updates

**Problem/Task:** The macOS app menu was missing the standard "About" and
"Check for Updates…" items. Need to add GitHub-based update detection
similar to plain-app's approach, with the PlainApp logo and a polished UI.

**Files created:**
- `src-tauri/src/commands/updater.rs` — GitHub API–based update detection.
  `check_for_updates` fetches
  `https://api.github.com/repos/plainhub/plain-desktop/releases/latest`,
  compares tags (with unit tests) and returns an `UpdateCheck` result.
  `get_app_info` returns version/name.
- `src/views/about/AboutView.vue` — Self-contained About window using the
  `public/logo.svg` logo, app version, a "Check for Updates" button with a
  loading spinner, and success/error/update states. Opens the release page
  via the opener plugin.

**Files modified:**
- `src-tauri/Cargo.toml` — removed `tauri-plugin-updater`
- `src-tauri/tauri.conf.json` — removed updater config (was returning HTML
  from the releases page, which the plugin could not parse as its JSON
  manifest)
- `src-tauri/src/commands/window.rs` — added `open_about` creating a small
  centered "about" window; emits `update-check-requested` when re-checking
- `src-tauri/src/commands/macos_menu.rs` — replaced predefined About with a
  custom "About PlainApp" item; both About and Check for Updates open the
  About window
- `src-tauri/src/lib.rs` — registered `check_for_updates` command
- `src-tauri/capabilities/default.json` — added `about` window
- `src/plugins/router.ts` — added `/about` route

**Result:** `cargo check` and `cargo test` pass (2 updater tests). Frontend
`yarn typecheck` passes.

### 2026-08-16 03:10 (Asia/Shanghai) — Simplify About window

**Problem/Task:** Trim the About UI — remove the Check for Updates menu item
(keep only About PlainApp), drop the title/tagline lines, and only prompt for
an update when the remote version is strictly greater than the local one.

**Files modified:**
- `src-tauri/src/commands/macos_menu.rs` — removed the "Check for Updates…"
  menu item and its handler
- `src-tauri/src/commands/window.rs` — `open_about` no longer takes a `check`
  flag; always opens `/about`
- `src/views/about/AboutView.vue` — removed app title and tagline; auto-runs
  the check on mount; shows the update prompt only when `hasUpdate` is true,
  otherwise a quiet "You're up to date" state

**Result:** `cargo check` and `yarn typecheck` pass.

### 2026-08-16 (Asia/Shanghai) — Remove obsolete UDP multicast `discover.rs`

**Problem/Task:** `src-tauri/src/commands/discover.rs` held the old custom UDP
multicast scan (`224.0.0.100:52352`, `DISCOVER:`/`DISCOVER_REPLY:` prefix
protocol). After the plain-app sync commit `56dc88a` ("refactor scan/pairing
flow"), LAN discovery moved to standard mDNS (`_plainapp._tcp.local`); the
new implementation lives in `src-tauri/src/commands/discover/` (directory
module). `commands/mod.rs` loads the module via `#[path = "discover/mod.rs"]`,
so `discover.rs` was orphaned dead code.

**Files deleted:**
- `src-tauri/src/commands/discover.rs`

`if_addrs` dependency retained — still used by `NearbyNetwork.rs`.

**Result:** `cargo check` clean (exit 0; only 5 pre-existing unrelated
warnings). No references to the removed symbols remain.

---

### 2026-08-16 19:55 (Asia/Shanghai) — Extract Rust crypto into plain-rs crate

**Problem:** The crypto module (ECDH P-256, Ed25519, XChaCha20-Poly1305,
base64/hex) lived inside plain-desktop and could not be shared with other
PlainApp backends.

**Work done:**
- Created `plainhub/plain-rs` (public GitHub repo) and authored it as a
  standalone Rust library exposing the same crypto API at the crate root
  (`base64_encode/base64_decode`, `EcdhSession`, `ed25519_generate/sign/verify`,
  `xchacha_encrypt/decrypt` + raw variants, `chacha20_encrypt/decrypt`,
  `gen_token`, `random_bytes`). Moved the cross-platform vector tests and
  `crypto-vectors.json` fixture along with it (18 tests pass).
- `src-tauri/src/crypto/` removed; `mod crypto;` dropped from `lib.rs`.
- All 28 `crate::crypto::` references across 21 files rewritten to `plain_rs::`.
- `src-tauri/Cargo.toml`: added
  `plain_rs = { git = "https://github.com/plainhub/plain-rs", rev = "08d92b5b4639f25853a5c9fa711258da2f527f87", package = "plain-rs" }`
  (git dependency pinned to a rev, so local edits to `plainhub/plain-rs` must be
  pushed and the rev bumped; works in CI without workflow changes);
  removed now-unused `chacha20poly1305`, `p256`, `ed25519-dalek`. Kept `sha2`
  (file store) and `rand` (prefs tests).

**Files modified:**
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- 21 files under `src-tauri/src/` (crate::crypto → plain_rs)
- `DONE.md`

**Result:** `cargo check` clean; `cargo test` 135 passed, 0 failed.

---

### 2026-08-17 (Asia/Shanghai) — Fix web login stuck on /login when no password is set

**Problem/Task:** plain-app issue #341 — with no web-access password set, after
the automatic login flow and browsing, pressing browser Back lands on
`/login?redirect=...` and the login screen cannot be passed (the app appears
stuck forever).

**Root cause:** In `src/views/login/login.ts`, `initRequest()` only auto-redirected
when the `/init` 200 response body was empty (`r.status === 200 && token && !bodyText`).
But the server always returns a JSON body; when it accepts the presented session
token it returns `InitResponse(signaturePublicKey)` **without** a `password` field,
so the auto-skip branch was dead code and the form fell into
`showPasswordInput = true`. With `PasswordType.NONE` the server silently replaces
the (empty) password with a random one on every `/init` without a valid token, so
once the form demands a password there was no way through.

**Fix:** Treat a 200 response with a valid token and no `password` field as "already
authenticated" (the server only omits `password` when it accepted the token). The
login flow then auto-skips and redirects back to the intended page.

**Files modified:**
- `src/views/login/login.ts` — `initRequest()` now parses the body once, and
  returns early via `finishLoginSuccess()` when `r.status === 200 && token &&
  !initData?.password`; otherwise falls through to auto-fill/auto-show password as
  before. Presence of a `password` field still drives the no-password auto-submit
  flow; empty body + token still auto-skips (kept).

**Result:** `yarn typecheck` clean. Back-navigation onto `/login` with a valid
session token now auto-redirects instead of trapping the user on the password form.

---

### 2026-08-17 ~13:00 (Asia/Shanghai) — DLNA receiver (direct translation from plain-app)

**Task:** Translate plain-app Kotlin DLNA receiver to Rust + Vue frontend.

**Files created (Rust backend):**
- `src-tauri/src/local/dlna/mod.rs` — module root, `is_receiver_path` helper
- `src-tauri/src/local/dlna/types.rs` — `DlnaMediaType`, `DlnaPlaybackState`, `DlnaCommand`, `PendingCastRequest`
- `src-tauri/src/local/dlna/renderer_state.rs` — `DlnaRendererState` (shared state), `DlnaRendererStateSnapshot`
- `src-tauri/src/local/dlna/ssdp_messages.rs` — SSDP alive/search/byebye message builders
- `src-tauri/src/local/dlna/soap_handler.rs` — SOAP request parsing, response building, DIDL-Lite media type extraction
- `src-tauri/src/local/dlna/xml_templates.rs` — device description.xml, AVTransport, RenderingControl SCPD XML
- `src-tauri/src/local/dlna/http_router.rs` — DLNA HTTP route handler (description.xml, AVTransport, RenderingControl, event)
- `src-tauri/src/local/dlna/receiver_engine.rs` — `DlnaEngine` (start/stop, SSDP advertiser, command processor, rule check)
- `src-tauri/src/local/dlna/commands.rs` — Tauri commands: `dlna_state`, `dlna_set_enabled`, `dlna_accept_cast`, `dlna_reject_cast`, `dlna_senders`, `dlna_remove_sender`

**Files created (frontend):**
- `src/views/device-info/use-dlna.ts` — `useDlna()` composable wrapping `dlna_state`/`dlna_set_enabled`/`dlna_senders` invoke calls

**Files modified:**
- `src-tauri/src/prefs.rs` — DLNA preferences: `get_dlna_enabled`/`set_dlna_enabled`, allowed/denied sender lists, `add_dlna_sender`/`remove_dlna_sender`/`dlna_senders_contain_ip`
- `src-tauri/src/local/server/http_handler.rs` — DLNA route detection + plain-text handler (no token), `respond_dlna` helper
- `src-tauri/src/local/server/mod.rs` — `LocalServerState` accepts `DlnaEngine` in `AppCtx`
- `src-tauri/src/lib.rs` — `DlnaEngine` managed state, auto-start on pref, `generate_handler!` registration
- `src/views/device-info/DeviceInfoView.vue` — DLNA card with toggle switch, status/port/error display
- `src/locales/*/device.ts` — `dlna_receiver`, `dlna_receiver_desc`, `error` keys in all 17 languages

**Result:** `cargo check` passes (exit code 0). `yarn typecheck` clean. `yarn lint` — only pre-existing errors (unrelated to DLNA).



---

### 2026-08-17 23:35 (Asia/Shanghai) — Replace deviceSessions with peers.token

**Problem:** `device_sessions` (frontend prefs store) and the `peers` table
had no linkage: a device could exist in one but not the other, so the
centralized host updates (mDNS) could not reliably heal login-session
addresses, and login state was duplicated in two places.

**Task:** Delete the deviceSessions store; add a `token` column to the
`peers` table. Login creates/refreshes the peer row with the token
(status stays UNPAIRED unless paired), logout clears the token. Web
(non-Tauri) builds read the token from `localStorage.auth_token`. Old
deviceSessions data is abandoned.

**Files modified:**
- `src-tauri/src/local/db/mod.rs` — peers table gains `token` column (+migration)
- `src-tauri/src/local/db/peer.rs` — `DPeer.token`, `login_peer` (also
  persists the TOFU `signaturePublicKey` into `public_key`), `logout_peer`,
  `update_peer_name`, `get_login_peers` (+7 unit tests)
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs` — login-peer
  wrappers, `LoginPeer` DTO, resident-listener refresh now covers
  logged-in (token) peers
- `src-tauri/src/commands/discover/mod.rs` — `login_peer` / `logout_peer` /
  `list_login_peers` / `update_peer_name` Tauri commands
- `src/lib/device/login-peers.ts` (new) — reactive mirror of the peers-table
  login rows; `saveLoginPeer` / `clearLoginPeer` / `updateLoginPeerName`;
  web fallback to `localStorage.auth_token`
- `src/lib/device/current.ts` — `getCurrentAuthToken` / `getCurrentDeviceHost`
  / `clearCurrentSession` read from the mirror (Tauri) or localStorage (web)
- `src/main.ts` — `preloadLoginPeers()` during bootstrap (before mount, so
  the router guard reads tokens synchronously)
- `src/hooks/app-socket.ts` — `device-host-changed` re-pulls the mirror
- `src/views/login/login.ts` — login writes the peer row then binds the client
- `src/components/TauriTabBar.vue`, `src/components/DeviceSwitcherModal.vue`,
  `src/views/app-rail/RailSettingsPopup.vue`, `src/App.vue`,
  `src/plugins/router.ts`, `src/hooks/main-view.ts` — switched off the store
- `src/stores/device-sessions.ts` — deleted
- `tests/lib/api/gql-client.test.ts` — token source moved to localStorage

**Result:** `cargo test` 120 passed; `yarn typecheck` clean; `yarn test`
back to pre-existing baseline (51 integration tests require a live device).

---

### 2026-08-18 00:10 (Asia/Shanghai) — Drop LoginPeer DTO, reuse Peer + DeviceType enum

**Problem:** `LoginPeer` duplicated the existing `Peer` model (both Rust
DTO and frontend interface), and `deviceType` was typed as plain string.

**Task:** Reuse the GraphQL `Peer` (types.rs) and the frontend `IPeer`;
type `deviceType` as the `DeviceType` enum end to end.

**Files modified:**
- `src-tauri/src/local/graphql/schema/types.rs` — `Peer` now also derives
  `Serialize` (camelCase); new `token` / `public_key` fields marked
  `#[graphql(skip)]` so they serialize for Tauri commands but stay out of
  the GraphQL schema; `from_dpeer` carries them
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs` — deleted the
  `LoginPeer` struct; `login_peers()` returns `Vec<Peer>` with the live
  online flag; `login_peer` takes `DeviceType` directly (no manual parse)
- `src-tauri/src/commands/discover/mod.rs` — commands use `Peer` /
  `DeviceType` params
- `src/lib/status.ts` — `DeviceType` gains `UNKNOWN`
- `src/lib/device/login-peers.ts` — `LoginPeer` is now a type alias
  `IPeer & { token; publicKey }`; `peerHost()` helper composes `ip:port`
- `src/lib/device/current.ts`, `src/views/login/login.ts`,
  `src/components/TauriTabBar.vue`, `src/components/DeviceSwitcherModal.vue`,
  `src/App.vue` — field renames (`clientId`→`id`, `host`→`peerHost()`,
  `signaturePublicKey`→`publicKey`), `DeviceType` enum at the boundary
- `src/views/chat/PeerInfoModal.vue` — deviceTypeMap covers `UNKNOWN`

**Result:** `cargo test` 120 passed; `yarn typecheck` clean; lint errors
only in untouched `text-file.ts` (pre-existing).

---

### 2026-08-18 01:00 (Asia/Shanghai) — NearbyModal empty: discovery start routed to remote phone

**Problem:** NearbyModal showed no devices while the mDNS debug page had
data. Logs showed `device … complete but browser not discovering; skipping
nearby emit`: the resident listener resolved devices fine, but the local
scan loop was never started. Root cause: `use-device-discovery.ts`
start/stop went through GraphQL mutations, which `gqlFetch` routes to the
bound remote phone in remote mode — the phone started ITS scan; the local
browser stayed idle and `on_device_found`'s scan gate suppressed all
nearby events.

**Fix:**
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs` —
  `emit_event` now also emits `nearby_device_found` /
  `nearby_discovery_started` / `nearby_discovery_stopped` as Tauri events
  straight to the webview (parallel to the WS broadcast, which routes to
  the remote phone in remote mode).
- `src-tauri/src/commands/discover/mod.rs` + `src-tauri/src/lib.rs` — new
  `mdns_is_browsing` command (mirrors `isDiscovering`).
- `src/hooks/use-device-discovery.ts` — Tauri mode drives discovery via
  local commands (`mdns_start_browse` / `mdns_stop_browse` /
  `mdns_is_browsing`) instead of GraphQL mutations; bridges the three
  Tauri events onto the emitter (idempotent merge-by-id, so the WS path
  can coexist).
- `src/views/chat/PeerInfoModal.vue` — deviceTypeMap typecheck fix
  (final: `DeviceType.UNKNOWN` removed from the frontend enum per review;
  `login.ts` already falls back to `DeviceType.OTHER`).

**Result:** `yarn typecheck` clean; `cargo check` clean (pre-existing
warnings only); `yarn test` 407 unit tests pass — the 51 failing
integration tests require a live device endpoint (pre-existing baseline).

### 2026-08-18 10:30 (Asia/Shanghai) — Simplify nearby discovery: drop scan-gate, emit on change only

**Problem:** NearbyModal showed no devices even though mDNS responses
arrived complete. Root cause: `on_device_found` gated every
`WS_NEARBY_DEVICE_FOUND` emission on `browser.is_running()` — when the
frontend's `start()` failed to reach the backend (refcount early-return),
no mutation was sent, the scan loop never started, and the entire event
path stayed silent. Compensating complexity had accumulated: a Tauri
event bridge, an `mdns_is_browsing` command, and a 5s frontend polling
keep-alive.

**Fix:**
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs` — removed
  the scan-gate; `on_device_found` now dedups by content via
  `same_snapshot` (ignores `last_seen`): repeated identical mDNS
  announcements emit once, real changes (IP / port / name / status /
  version / platform) re-emit. Resident listener keeps feeding the
  nearby list regardless of the scan loop. Removed the Tauri dual-channel
  emit from `emit_event` (WS broadcast is the single channel again) and
  all diagnostic logging. Unit test added for `same_snapshot`.
- `src-tauri/src/commands/discover/mod.rs` + `src-tauri/src/lib.rs` —
  removed the `mdns_is_browsing` command (no callers).
- `src-tauri/src/local/graphql/schema/discover.rs` — removed diagnostic
  resolver logs.
- `src/hooks/use-device-discovery.ts` — removed the 5s
  `isDiscovering` polling keep-alive; `start()` now always sends the
  `startDiscovery` mutation (backend is idempotent), stop() keeps the
  refcount. Removed debug logs.
- `src/lib/api/gql-client.ts` / `src/hooks/app-socket.ts` — removed
  diagnostic logs added during investigation.

**Result:** `cargo check` clean; `cargo test nearby` passes
(`same_snapshot_ignores_last_seen_but_detects_changes`); `yarn typecheck`
clean. Device list now populates from the resident mDNS listener even
without an active scan; announcements no longer spam the WS channel.

### 2026-08-18 12:10 (Asia/Shanghai) — Extract mDNS protocol stack to plain-rs; delete dead discovery code

**Problem:** The mDNS protocol implementation (wire codec, socket responder,
service browser) lived inside plain-desktop's business layer
(`commands/discover/mdns/`, ~1700 lines). Business and protocol code were
entangled, which made the recent nearby-discovery debugging much harder than
it needed to be, and several dead paths had accumulated.

**Changes (plain-rs):**
- New `src/mdns/` module: `packet_codec` (DNS wire codec), `service_info`
  (service model + record accessors), `service_response_builder`,
  `host_responder` (shared 5353 socket, multicast join/send per interface,
  A-record responder), `service_browser` (PTR→SRV/TXT/A state machine,
  resident packet listener, 5s scan loop). All tests moved along.
- Decoupled from Tauri: `FoundDevice.device_type` is now a plain `String`
  (TXT `dv` value); the scan loop runs on a std thread instead of
  `tauri::async_runtime`.
- Removed dead API: `host_responder::stop` / `clear_service`, SRV
  priority/weight, record `cls`/`ttl`/`cache_flush`/`dns_class` accessors,
  authority-section parsing, and the per-packet debug log flood.
- Cargo.toml: + `log`, `if-addrs`, `socket2`, `serde`.

**Changes (plain-desktop):**
- Deleted `src-tauri/src/commands/discover/mdns/` (6 files);
  `NearbyDiscoverManager` now consumes `plain_rs::mdns::*` and converts
  `device_type` to the `DeviceType` enum at the business boundary.
- Deleted dead code: `discover_devices` one-shot scan (Tauri command,
  `DiscoverDevicesResult`, `DiscoverScanStatus`, `discover_devices_impl`),
  `schedule_restart`.
- `Cargo.toml`: plain-rs stays on the git dependency (no rev/tag);
  `Cargo.lock` updated to the new revision after plain-rs was pushed.

**Follow-up (same day):** restored the `isDiscovering` polling keep-alive
(`isDiscoveringGQL` + 5s `checkAndEnsureDiscovering` in
`use-device-discovery.ts`) — the app closing its nearby page stops the
server-side scan for every client, so the web must poll and re-issue
`startDiscovery` when it went down.

**Result:** plain-rs `cargo test` all green (incl. 8 moved mDNS tests);
plain-desktop `cargo check` clean (4 pre-existing warnings), `cargo test`
113 passed, `yarn typecheck` clean, `yarn test` 407 passed (51 failures are
the pre-existing live-device integration baseline). Net: ~1700 lines of
protocol code out of the app crate; discovery business logic is now
~440 lines.

---

### 2026-08-18 14:20 (Asia/Shanghai) — WS reconnect now nudges mDNS to heal stale peer address

**Problem:** On `TauriWebSocket` connection failure the retry loop always
re-resolved the peer's `ip:port` via `peer_address` (local SQLite, invisible
in DevTools Network), but nothing probed the network — if the device had
changed IP and its mDNS announcement hadn't arrived yet, reconnects kept
dialing the stale address from the peers table until an announcement landed.

**Changes:**
- `src-tauri/src/commands/discover/mod.rs` — new `mdns_browse` Tauri command
  wrapping `NearbyDiscoverManager::browse()` (one-shot PTR query; resident
  listener refreshes the peers table, no scan loop started).
- `src-tauri/src/lib.rs` — registered `commands::discover::mdns_browse`.
- `src/hooks/app-socket.ts` — `retryConnect()` fires `invoke('mdns_browse')`
  when `__IS_TAURI__ && !isLocalMode()`; the reply lands in the peers table
  during the 1–5 s retry delay so the reconnect dials the fresh address.

**Result:** `cargo check` clean (4 pre-existing warnings), `cargo test
discover` passed, `yarn typecheck` clean.

### 2026-08-18 (Asia/Shanghai) — Fix desktop notifications silently not showing on macOS

**Problem:** In `showDesktopNotification` the macOS branch always invoked the
osascript `send_macos_notification` command first and `return`ed on success. The
Rust command judged success solely by `osascript`'s exit code, which is `0` even
when the notification is silently dropped (app lacks UNUserNotificationCenter
authorization first run / system notifications disabled for the app). This
"false success" meant the reliable `tauri-plugin-notification` `sendNotification`
fallback never ran, so macOS showed no desktop notifications at all.

**Changes:**
- `src/lib/desktop-notification.ts` — removed the macOS osascript-first branch;
  Tauri now unifies on `tauri-plugin-notification`
  (`isPermissionGranted` → `requestPermission` → `sendNotification`, matching the
  granted-notification model). Non-Tauri (plain web) `Notification` API branch
  untouched.
- `src-tauri/src/commands/notification.rs` — deleted (dead code after the switch).
- `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs` — dropped the deleted
  module and the `send_macos_notification` invoke handler registration.

**Result:** `yarn typecheck` clean; `cargo check --offline` clean (4 pre-existing
warnings).

### 2026-08-18 (Asia/Shanghai) — Enable Toggle Developer Tools in release builds

**Problem:** Packaged release builds had no way to open DevTools, so users
couldn't inspect browser console errors. Two causes: Tauri 2 only ships the webview
inspector in debug builds unless the `devtools` Cargo feature is enabled, and the
custom macOS menu (which replaces Tauri's default menu) never included a
"Toggle Developer Tools" item.

**Files modified:**
- `src-tauri/Cargo.toml` — `tauri = { ..., features = ["devtools"] }` so the
  inspector is available in release builds. (On macOS it uses the private
  `_inspector` API, so this keeps the App Store out of scope by design.)
- `src-tauri/src/commands/macos_menu.rs` — added a `View` submenu with
  "Toggle Developer Tools" (`CmdOrCtrl+Option+I`); the menu event handler
  toggles devtools on the focused webview (falling back to `main`).

**Result:** `cargo check --offline` clean (4 pre-existing warnings). Users on
release builds can now open the inspector via View → Toggle Developer Tools or the
shortcut to read console errors.

### 2026-08-18 (Asia/Shanghai) — Release crash on image pick/upload: App Sandbox was enabled

**Problem:** Packaged release builds crashed when clicking the image picker, and
the upload button didn't respond. The macOS entitlements ignored App Sandbox
(`com.apple.security.app-sandbox = true`) while adding no
`com.apple.security.files.user-selected.read-only` entitlement, so sandboxed file
selection (NSOpenPanel via plugin-dialog, WKWebView `<input type=file>`, and
plugin-fs arbitrary-path reads) were denied — matching the crash / no-op.

**Files modified:**
- `src-tauri/entitlements.plist` — set `com.apple.security.app-sandbox` to
  `<false/>` (matches the file's own intent and the prior signing fix; non-App
  Store Developer ID distribution). Kept network client/server.

**Result:** Sandbox disabled restores user-selected file access for the image
picker and uploads. Tauri permission scope (`dialog:open`, `fs:allow-read-file`)
was already correct. Needs a fresh release `tauri build` to re-sign with the new
entitlement.

### 2026-08-18 (Asia/Shanghai) — App Store sandbox entitlements + keep Developer ID channel

**Problem:** Publish to the Mac App Store requires App Sandbox (+
`com.apple.security.files.user-selected.read-only` for file pick/upload). But
the same sandboxed/multicast entitlements would break the existing Developer ID
GitHub/notarize pipeline (its "Verify macOS notarization" step rejects
`com.apple.developer.*`; Dev-ID signatures can't carry restricted entitlements
without an embedded provisioning profile). MAS apps can't be redistributed via
GitHub anyway, so the two channels must use different entitlements.

**Files modified:**
- `src-tauri/entitlements.plist` — App Store sandbox set:
  `app-sandbox=true` + `files.user-selected.read-only=true` +
  `network.client/server=true` + `com.apple.developer.networking.multicast=true`
  (multicast already approved by Apple for this app; required for mDNS under
  sandbox; the approval must be baked into the App Store provisioning profile).
- `src-tauri/entitlements.plist.identity` (new) — Developer ID / direct-download
  set: `app-sandbox=false` + `network.client/server=true`, **no** multicast
  (non-sandboxed macOS apps don't need it — mDNS works on the plain sockets).
- `build-desktop.sh` — the GitHub release's `tauri build` now passes
  `--config '{"bundle":{"macOS":{"entitlements":"./entitlements.plist.identity"}}}'`
  so the Developer ID artifacts keep the non-sandboxed identity and pass
  notarization + the no-`com.apple.developer.*` guard.

**Result:** both plists `plutil -lint` OK; `tauri build --config` verified to
override the entitlements path. Developer ID GitHub release unaffected; the App
Store path uses the sandboxed `entitlements.plist` and still needs an App Store
cert + provisioning profile (with multicast) + `.pkg` build + Transporter upload
per the documented checklist.

### 2026-08-18 (Asia/Shanghai) — build-appstore.sh: MAS .pkg build + embed profile + upload

**Task:** Script the Mac App Store path end to end — Tauri build (both arches,
`bundle.targets=["app"]`, App Store signing identity + sandboxed
`entitlements.plist` via `--config`), embed `Contents/embedded.provisionprofile`,
re-sign the bundle, produce an installer-signed `.pkg`, and upload via altool.

**Files created:**
- `build-appstore.sh` — env-driven: `APPLE_APP_IDENTITY`,
  `APPLE_INSTALLER_IDENTITY`, `APPLE_PROFILE_PATH`, `APPLE_ID`/
  `APPLE_PASSWORD`/`APPLE_TEAM_ID` (upload), optional `ARCHS` green
  default `aarch64-apple-darwin x86_64-apple-darwin`, `SKIP_UPLOAD=1`.
  Builds only `.app` (no dmg), signs with App Store cert, embeds the profile,
  re-signs with hardened runtime + `entitlements.plist`, builds
  `productbuild` `.pkg` signed with the installer cert, runs
  `codesign --verify` + `pkgutil --check-signature`, then uploads each `.pkg`
  with `xcrun altool --upload-package --type macos`. Guards: requires the
  macOS 15 SDK (Runtime Version > 15 is killed on macOS 15) and a building
  profile.

**Result:** `bash -n` clean. Depends on the App Store cert + installer cert +
provisioning profile (with multicast) being installed / provided at runtime.

---

### 2026-08-18 23:50 (Asia/Shanghai) — Generic sortByName helper + unified device-session sorting

**Task:** Extract a reusable name-sort wrapper and use it for the same
case-insensitive ordering of logged-in device sessions in both the Tauri
tab-bar device dropdown and the device switcher modal.

**Files modified:**
- `src/lib/array.ts` — added `sortByName<T>(items, nameOf)` (localeCompare
  with `{ sensitivity: 'base' }`, returns a new sorted array).
- `src/components/TauriTabBar.vue` — `switchableSessions` now uses
  `sortByName(loginPeers.value, (p) => p.name)`.
- `src/components/DeviceSwitcherModal.vue` — `sessions` now sorts with the
  same `sortByName(loginPeers.value, (p) => p.name)` (previously unsorted).
- `tests/lib/array.test.ts` — added `sortByName` cases (case-insensitive
  ordering, non-mutating, empty/single-element arrays).

**Result:** `yarn test tests/lib/array.test.ts` passed (29 tests). `yarn
typecheck` shows only pre-existing errors in untouched `mirror-codec*` files.

---

### 2026-08-19 00:10 (Asia/Shanghai) — Unify all localeCompare usages into sortByName / compareLocale

**Task:** Remove the local `compareChannelName` helper and consolidate every
inline `localeCompare` call in the project into the shared sort utilities in
`src/lib/array.ts`, so `localeCompare` appears in exactly one place.

**Files modified:**
- `src/lib/array.ts` — added exported `compareLocale(a, b, options?)`
  (default `{ sensitivity: 'base' }`) used as the single comparison primitive;
  `sortByName` now takes optional `Intl.CollatorOptions` (numeric case) and
  delegates to `compareLocale`.
- `src/lib/chat/channel-cacher.ts` — removed `compareChannelName`, channels
  sorted via `sortByName`.
- `src/lib/chat/peer-cacher.ts` — name tie-breaker uses `compareLocale`.
- `src/stores/bookmarks.ts` — title + group-name tie-breakers use
  `compareLocale`.
- `src/hooks/directory-picker.ts` — mountPoint compare uses
  `compareLocale(…, { numeric: true })`.
- `src/hooks/messages-sidebar.ts` — NAME_ASC/NAME_DESC use `sortByName` (+
  `.reverse()` for DESC).
- `src/hooks/grouped-scroll.ts` — date-key descending sort uses
  `sortByName(...).reverse()`.
- `src/views/uploads/upload-list.ts` — batchCreatedAt compare uses
  `compareLocale` / `sortByName`.
- `src/lib/storage.ts` — mountPoint tie-breaker uses `compareLocale`.
- `src/components/BucketFilter.vue`, `src/components/header-search/options.ts`
  — bucket name sort uses `sortByName(…, { numeric: true })`.
- `src/components/ExtFilter.vue` — ext sort uses `sortByName`.
- `tests/lib/array.test.ts` — added `compareLocale` cases and a numeric-option
  case for `sortByName`.

**Result:** `localeCompare` / `compareChannelName` now only exist in
`src/lib/array.ts`. `yarn test tests/lib/array.test.ts` (33 tests) and
`tests/lib/chat-cacher.test.ts` (5 tests) passed. `yarn typecheck` shows only
pre-existing errors in untouched `mirror-codec*` / `screen-mirror-pipeline`
files; full-suite failures are pre-existing and unrelated (integration tests
need a running backend; `local-mode`/`window-client`/`mirror-codec-loss`
failures exist independently of this change).


### 2026-08-19 (Asia/Shanghai) — SwitchDeviceModal first-open shows no devices

**Problem:** After app start, opening the device-switcher / nearby modal the
first time showed an empty device list even though many devices had already
been discovered; closing and reopening immediately showed them.

**Root cause:** `NearbyDiscoverManager::start_discovery` early-returned
without re-emitting when the mDNS browser loop was already running. Devices
announced during the initial window populated `seen_in_session` and were
emitted (then deduped) before the frontend was listening, and the
`same_snapshot` dedup suppressed re-emitting them on the first `start()`.
Closing the modal worked only because `stop_discovery` clears
`seen_in_session`, so the reopen re-synced.

**Files modified:**
- `src-tauri/src/commands/discover/NearbyDiscoverManager.rs` — `start_discovery`
  now always clears `seen_in_session` (even when the loop is already running)
  and ensures the browser is browsing, so every UI open re-emits the current
  device set. Return value preserves the previous "started by me" semantics
  via `!already_running`.

**Result:** `cargo check --offline` clean (only pre-existing warnings);
`cargo test discover` passes (1 passing, 112 filtered).

---

### 2026-08-19 00:40 (Asia/Shanghai) — pendingLoginDevice refactor for login flow

**Problem:** DeviceSwitcherModal login step title showed `loginHost` (IP:port)
instead of the device name. Host and deviceType were carried as two separate
module-level vars (`_pendingLoginHost` / `_pendingLoginDeviceType`) with six
getter/setter functions.

**Files modified:**
- `src/lib/api/api.ts` — replaced both vars with a single
  `PendingLoginDevice { name, host, deviceType }` object and
  `set/clear/getPendingLoginDevice`
- `src/components/DeviceSwitcherModal.vue` — title shows
  `pendingLoginDevice?.name`; `startLoginStep` takes the whole device object
- `src/views/login/login.ts` — reads `getPendingLoginDevice()?.deviceType`
- `src/views/login/LoginView.vue` — sets the full pending device (web flow)

**Result:** vue-tsc clean for touched files (remaining errors pre-exist in
mirror-codec/screen-mirror); eslint passed; the only test importing api.ts
(upload-utils.test.ts) passes — other failing tests pre-exist on HEAD.

### 2026-08-19 01:32 (Asia/Shanghai) — 统一 modal 关闭按钮到右上角 X

**Task:** 所有 modal 的关闭按钮统一放到右上角，以单个 X icon button
封装在基类里；各 modal 底部不再放置 close/cancel 关闭按钮。

**Design:**
- 在 `src/components/base/VModal.vue` 内部绝对定位渲染一个统一的
  `.v-modal-close` X 按钮（点击 `emit('close')`，沿用各父组件已绑定的
  `@close` 处理器，无需逐文件传递关闭逻辑）。
- `#headline` 右侧留出 `padding-right: 48px` 避免标题与 X 重叠。
- 底部 `#actions` 只保留有意义的主操作（Save/Send/Delete/Confirm/
  Try Again/Export/Refresh/Allow/Deny/Accept/Decline 等），移除纯
  Close/Cancel 关闭按钮。

**Files modified:**
- `src/components/base/VModal.vue` — 新增统一右上角 X 关闭按钮 + `$t`
  + `.v-modal-close` 样式 + headline 右侧 padding。
- 移除底部 Close/Cancel 按钮的 modal：
  `src/views/chat/{PeerInfoModal,ChannelInfoModal,NearbyModal}.vue`
  `src/components/DeviceSwitcherModal.vue`
  `src/views/app-rail/{CustomizeUIModal,ExcludedDirsModal}.vue`
  `src/components/ai/AIImageSearchModal.vue` `src/views/MainView.vue`
  (仅保留主操作) `src/views/chat/{CreateChannelModal,RenameChannelModal,
  ChatRetryModal,ChatDeliveryStatusModal}.vue`
  `src/views/device-info/MdnsDebugModal.vue`
  `src/components/{DirectoryPickerModal,EditContactModal,PromptModal,
  EditValueModal,AddFeedModal,DeleteFileConfirm,DownloadMethodModal,
  KeyboardShortcutsModal}.vue`
  `src/views/messages/{SendSmsModal,ExportSmsModal}.vue`
  `src/views/feeds/FeedModal.vue`
  `src/views/bookmarks/{EditBookmarkModal,AddBookmarksModal}.vue`

**Result:** eslint passed on all touched files; typecheck remaining errors
are pre-existing in mirror-codec/screen-mirror and unrelated.

---

### 2026-08-19 (Asia/Shanghai) — ChannelInfoModal device icon view-raw

**Task:** 参考 NearbyModal，为 ChannelInfoModal 里 ChannelMemberListItem
的 device icon 加上 view-raw 功能：点击设备图标弹出 v-dropdown，展示该
成员/peer 的原始数据，便于调试。

**Design:**
- 复用 NearbyModal 的 `v-dropdown` + `<pre class="view-raw">` 模式。
- ChannelMemberListItem 是 ChannelInfoModal 专属组件，直接在组件内部
  用单个 `rawOpen` ref 维护下拉开关（每个列表项独立实例，无需按 id 建
  记录表）。

**Files modified:**
- `src/views/chat/components/ChannelMemberListItem.vue` — 将
  `#start` 中的 `DeviceTypeIcon` 包进 `v-dropdown`，下拉内容为
  `<pre class="view-raw">{{ member }}</pre>`；新增 `rawOpen` ref。

**Result:** typecheck remaining errors are pre-existing in
mirror-codec/screen-mirror and unrelated to this change.

### 2026-08-19 09:30 (Asia/Shanghai) — mDNS 扫描排障：probe 工具 + NSCOUNT 解析对齐

**Problem:** plain-desktop 扫不到 `_plainapp._tcp.local` 设备，但 `dns-sd -Z` 能看到多台。

**Task:** 写独立测试程序定位；排查 plain-rs 浏览代码。

**Files:**
- 新增 `src-tauri/src/bin/mdns_probe.rs`：dump 所有入站 5353 包 + 跑真实 browser，`cargo run --bin mdns_probe`（在 src-tauri 目录下运行才走本地 plain-rs patch）。
- 修改 `plain-rs/src/mdns/packet_codec.rs`：`parse_response` 补跳过 authority section（NSCOUNT），与 Kotlin `MdnsPacketCodec.parseResponse` 对齐；新增 `parse_response_skips_authority_section` 测试。

**Result:** 证据链（probe 60s 零外部包 / dns-sd 同窗口解析成功 / 昨日 pcap 显示设备响应到达网卡 / 独立 Python socket 同样收不到）证明扫描代码收包逻辑无误，是 macOS 对普通进程的入站组播被拦截（Local Network 权限或 utun4 TUN 代理）。`cargo test --lib mdns` 12 通过。待用户授权 Local Network（Terminal + PlainApp）或断开 TUN 代理后用 probe 复验。

### 2026-08-19 11:00 (Asia/Shanghai) — mDNS 收不到外部组播的根因定位（接口排除 + QU 单播对照）

**Problem:** 怀疑 WiFi 接口（en1）选择错误导致扫不到设备。

**Task:** 多 socket 对照实验：A=0.0.0.0:5353 join en1、D=192.168.123.15:5353 join en1、C=临时端口 join en1；passive 监听 + 标准 PTR 查询 + QU（单播响应）查询；与 dns-sd 同窗口对照。

**Files:** 新增 `src-tauri/src/bin/mdns_iface_test.rs`（诊断工具）。

**Result:** 接口理论排除——同一 en1 上手机的单播响应可达 C（4 个 RESPONSE，Pixel 7/MacBook），而 A/D 的外部组播为 0；mDNSResponder 同窗口成功解析两台 Pixel，但手机的组播响应不进任何普通 socket（含本机回环组播正常、外部单播正常）。系统无网络过滤扩展（仅 Samsung USB DriverKit）。根因：macOS 26.5 不向普通进程投递外部源组播（Local Network 权限最可能），mDNSResponder 作为系统守护进程豁免。已验证 QU 查询+临时端口可绕过（plain-app 手机端支持 QU）。

### 2026-08-19 12:00 (Asia/Shanghai) — mDNS QU 兜底（跨频组播被路由器丢弃的场景）

**Problem:** 路由器（SmartABC_5G ↔ SmartABC 双频段）丢弃跨频组播：Mac 在 5G、手机在 2.4G 时 browser 收不到任何外部组播响应，但单播可达（QU 查询实测收到 4 个响应）。

**Task:** plain-rs browser 增加 QU 兜底：检测组播死亡后改用专用临时端口 socket 发 QU 查询（RFC 6762 §5.4），单播响应经 notify_packet_listeners 汇入现有 handle_packet。

**Files:** plain-rs `src/mdns/host_responder.rs`（QU socket + take_external_multicast_seen + send_to_group 抽取）、`src/mdns/service_browser.rs`（qu_active/browse_cycles/dispatch_query，QU_FALLBACK_AFTER_CYCLES=2）、`src/mdns/packet_codec.rs`（2 个新测试）。

**Result:** 机制——第 1 个扫描周期发 QM；连续 2 周期无外部组播 → 激活 QU（sticky，QU 在健康网络同样可用故不回切）；PTR/SRV/TXT/A 查询与 send_ptr_query 均经 dispatch_query 路由。QU socket 用临时端口而非 5353：5353 上多 SO_REUSEPORT socket（如另一个 PlainApp 进程）会抢走单播响应。cargo test --lib mdns 14 全过；健康网络 probe 回归正常（发现 MacBook-Pro，未激活 QU）。**注意：plain-app Kotlin browser 无此机制（仅 responder 支持 QU 应答），手机在 2.4G 同样扫不到 5G 设备，需另行移植。** plain-rs 改动未提交。

### 2026-08-19 13:00 (Asia/Shanghai) — plain-app Kotlin 侧 mDNS QU 兜底移植

**Problem:** Rust 侧已实现 QU 兜底，但 plain-app Kotlin browser 全部走组播 sendQuery —— 手机在 2.4G、对端在 5G 时同样扫不到设备（Kotlin responder 本就支持 QU 单播应答，仅 browser 缺兜底）。

**Task:** 按与 plain-rs 相同的设计移植到 shared-lib commonMain（Android/iOS 双端生效）。

**Files:** `MdnsHostResponder.kt`（sawExternalMulticast 标志 + takeExternalMulticastSeen；QU socket 随 restartSocket 创建/tearDownSocket 关闭，临时端口、不 join 组、专用 quReceiveLoop 走 notifyPacketListeners；sendQuery 抽取 sendToGroup 复用）；`MdnsServiceBrowser.kt`（quActive sticky + browseCycles，QU_FALLBACK_AFTER_CYCLES=2，shouldActivateQuFallback 纯函数，dispatchQuery 路由 PTR/SRV/TXT/A 与 sendPtrQuery）；新增 `MdnsServiceBrowserTest.kt`（6 测试：激活边界、sticky 语义、QU 位线上格式）。

**Result:** Kotlin common 无 synchronized（Kotlin/Native），QU socket 改为随主 socket 生命周期创建（restartSocket/tearDownSocket），无锁无竞态。SRV/TXT 查询改用 buildQuery(FQDN, QU) 直构（buildSrvQuery 无 QU 参数）。testAndroidHostTest 全过（含全部 mdns 测试），compileKotlinIosArm64 通过。改动未提交。

---

### 2026-08-19 16:35 (Asia/Shanghai) — ScreenMirror 桌面 App 模式 fullscreen 按钮无效

**Problem:** plain-desktop 投屏中点击 fullscreen 按钮无效果（仅桌面 App / Tauri 模式复现）。

**Root cause:** `screen-mirror-media.ts` 的 `toggleFullscreen` 走 HTML5 Fullscreen API（`wrapper.requestFullscreen()` / `document.fullscreenElement`）。Tauri macOS 的 WKWebView 不支持元素级 Fullscreen API，调用静默无效；`fullscreenchange` 事件也不会在原生窗口全屏时触发。

**Fix:** Tauri 模式改用原生窗口 API `getCurrentWindow().isFullscreen()/setFullscreen()` 切换并同步状态；`onResized` 监听窗口尺寸变化以同步图标状态（覆盖绿点按钮/快捷键进出的全屏）。Web 模式行为不变。`core:default` 仅含只读 `allow-is-fullscreen`，需显式授予 `core:window:allow-set-fullscreen`。

**Files modified:**
- `src/views/screen-mirror/screen-mirror-media.ts` — `toggleFullscreen` Tauri 分支；`syncFullscreen`（Tauri 查询原生状态 / Web 读 `fullscreenElement`）；`attachFullscreenListener`/`detachFullscreenListener`（`onResized` 同步）
- `src/views/screen-mirror/ScreenMirrorView.vue` — `onActivated`/`onDeactivated` 挂载/卸载 Tauri 监听
- `src-tauri/capabilities/default.json` — 新增 `core:window:allow-set-fullscreen`（生成的 `gen/schemas/capabilities.json` 同步）

**Result:** `yarn typecheck`、`yarn lint` 通过。既有测试失败（integration fetch failed、local-mode/window-client/cross-window-store）与本次改动无关，未改动文件被任何测试引用，基线 stash 验证为环境相关抖动。
