# AGENTS.md

> Web UI for [PlainApp](https://github.com/plainhub/plain-app) — a self-hosted phone
> manager. Vue 3.5 + TypeScript frontend, Rust + Tauri 2 backend, GraphQL over an
> encrypted local server (TLS + XChaCha20-Poly1305).

## Setup commands

- Install deps: `yarn`
- Dev (web only): `yarn dev` — `http://localhost:3000`
- Dev (Tauri desktop): `yarn dev:tauri`
- Build (web): `yarn build`
- Build (Tauri): `yarn build:tauri`
- Frontend typecheck: `yarn typecheck`
- Frontend lint: `yarn lint` (runs ESLint with `--fix`)
- Frontend tests: `yarn test` / `yarn test:watch` (Vitest, happy-dom)
- Rust check: `cargo check --manifest-path src-tauri/Cargo.toml`
- Rust test: `cargo test --manifest-path src-tauri/Cargo.toml`
- Rust clippy: `cargo clippy --manifest-path src-tauri/Cargo.toml`

> `.env` holds `VITE_APP_API_HOST` etc. — copy `.env` to `.env.local` for local dev.

## Project layout

```
.
├── src/                    # Vue 3 + TypeScript frontend
│   ├── views/<feature>/    # Route-level pages (chat/, files/, notes/, …)
│   ├── components/
│   │   ├── base/           # V-prefixed Material Design primitives
│   │   └── <feature>/      # Feature components (chat/, files/, media/, …)
│   ├── hooks/              # Composables (chat-*, upload, files, …)
│   ├── stores/             # Pinia stores
│   ├── lib/                # Shared utilities (api/, upload/, platform, strutil, …)
│   ├── locales/en-US/      # vue-i18n, per-feature module files
│   └── plugins/            # apollo, router, i18n, …
├── src-tauri/              # Rust backend (Tauri 2)
│   └── src/
│       ├── commands/       # Tauri command handlers
│       ├── crypto/         # XChaCha20-Poly1305 + ECDH P-256 + Ed25519
│       ├── http_proxy/     # HTTP/WS proxy to Android device
│       ├── local/          # Self-hosted local server (the chat system)
│       │   ├── db/         # rusqlite models (channel, peer, chat, file, …)
│       │   ├── channel/    # Channel senders + handlers + helpers
│       │   ├── graphql/    # async-graphql schema (chat_*.rs, app.rs, …)
│       │   ├── peer_graphql/ # Per-peer GraphQL endpoint (Android side)
│       │   ├── server/     # axum / tokio-tungstenite local server
│       │   └── pairing/    # Device pairing flow
│       └── utils/          # base64, short_uuid, query, mime, http, hex
├── docs/                   # ARCHITECTURE.md, chat alignment, transport, …
├── tests/                  # Vitest specs
└── public/                 # Static assets
```

## Code style

- **Vue 3.5** with `<script setup lang="ts">` + Composition API. No Options API.
- **TypeScript strict** (extends `@vue/tsconfig/tsconfig.dom.json`).
- **Pinia 3** for cross-component state; `ref`/`reactive` for local state.
- **GraphQL**: Apollo Client on the frontend; `async-graphql` on the backend.
  Field names stay `snake_case` in Rust — the framework auto-converts to
  `camelCase` on the wire. Do not hand-write `#[graphql(name = …)]` to match
  the Android spelling.
- **Rust resolvers stay thin**: parse args → call `crate::local::db::*` or
  `crate::local::channel::sender::*` → emit a `WsEvent` → return the model.
  No business logic in resolver bodies.
- **No comments in new code** unless the user asks. See
  `.trae/rules/project_rules.md` for the full rule.
- **Prettier + ESLint flat config** — `yarn lint` runs `--fix`.
- **Minimize dependencies**: prefer hand-rolling 5–30 lines over pulling in
  a new crate. The repo already inlines `base64`; query parsing,
  percent-decode, and hex encoding follow the same pattern. See
  `src-tauri/src/utils/{query,hex}.rs` and `src/lib/strutil.ts`.

## Shared utilities — where to put (and find) helpers

Before writing a new helper, grep the existing utils — duplication has
bitten this codebase more than once.

**Backend — `src-tauri/src/utils/`**

| Module | Exports | When to use |
|---|---|---|
| `base64.rs` | `base64_encode` / `base64_decode` | RFC 4648 base64; hand-rolled, no `base64` crate. |
| `short_uuid.rs` | `short_uuid` | 22-char base36 ID for chat channels / peers. |
| `query.rs` | `percent_decode`, `parse_query`, `query_get` | URL query parsing. Replaces the old `percent-encoding` crate. |
| `mime.rs` | `mime_from_ext`, `mime_extension` | Extension ⇄ MIME. Inverse pair — add new types to **both** match arms. |
| `http.rs` | `CORS` constant | Shared CORS preamble for the local server **and** the upstream HTTP proxy. |
| `hex.rs` | `bytes_to_hex` | Lowercase hex encoding. Replaces per-file `format!("{:02x}")` loops and the `hex_lower` helper. |

HTTP response framing for the local server lives in
`src-tauri/src/local/server/response.rs::respond` — the file-server
streaming variant is in `file_server.rs` because it bypasses `respond()`
to stream the body in 64 KB chunks.

**Frontend — `src/lib/`**

| Module | Exports | When to use |
|---|---|---|
| `strutil.ts` | `bytesToHex`, `arrayBufferToHex`, `base64ToArrayBuffer`, `arrayBufferToBase64`, `randomUUID`, `shortUUID`, `encodeBase64`, `decodeBase64` | Hex + base64 + IDs. **All new hex code goes through `bytesToHex`** — the inline `(b & 0x0f).toString(16)` pattern in the old `time-sync.ts` was a real entropy-loss bug. |
| `platform.ts` | `isMacPlatform`, `isMobilePlatform` | Synchronous UA-based boolean helpers. `lib/agent/` is for full UA parsing — use it when you need the whole `AgentInfo`. |
| `file.ts` | `isImage`, `isVideo`, `isAudio`, `isDoc`, `isTextFile`, `isAppFile`, `getFileExtension`, … | Extension-based file-type predicates. |
| `format.ts` | `formatDateTime`, `formatTimeAgo`, `formatFileSize`, `formatSeconds`, `generateDownloadFileName` | i18n-aware date / size / time formatters. |
| `array.ts` | `debounce`, `sample`, `arrayRemove`, `deleteById`, `truncateText` | Array / control-flow helpers. |
| `agent/` | `getAccurateAgent`, `getLegacyAgent` | Full `AgentInfo` (os / browser / mobile flag). Async — avoid in `computed()` initializers. |
| `api/` | `getApiBaseUrl`, GraphQL client, `getFileId` | HTTP / GraphQL surface; not generic utilities. |
| `upload/` | chunked upload, `getMD5Hash` | Upload pipeline. |

## Testing instructions

- Frontend: `yarn test` (Vitest, happy-dom). Specs live in `tests/lib/`.
- Backend: `cargo test --manifest-path src-tauri/Cargo.toml`. Behavior
  changes ship with a `#[cfg(test)]` module in the touched file.
- Add tests for every new behavior; mirror the existing test layout.
- All tests must pass before opening a PR.

## Security

- Never commit secrets — `.env` is in `.gitignore`.
- Local server uses TLS + XChaCha20-Poly1305; see `src-tauri/src/crypto/`.
- ECDH P-256 + Ed25519 keys are device-bound — never log raw key bytes.
- File store uses SHA-256 content addressing — see
  `src-tauri/src/local/app_file_store.rs`.

## Related docs

- `docs/ARCHITECTURE.md` — full project map (read first when lost)
- `docs/graphql-client.md` — GraphQL transport notes
- `docs/tauri-proxy-strategy.md` — Tauri proxy performance/stability
- `docs/file-upload.md` — generic file upload flow
