# Copilot Instructions for plain-web

> **Start here**: Read `docs/ARCHITECTURE.md` for project structure and directory map.

## Code Standards (MUST follow for ALL changes)

1. **Max 400 lines per file** — split into components/composables if exceeded. It is strictly forbidden to reduce line count by removing blank lines or whitespace — every split must be a genuine logical decomposition.
2. **Components first** — prefer extracting UI into reusable components over inlining.
3. **All logic in composables** — pages/views only compose; no business logic, no data fetching, no mutations in `*View.vue` / `*Page.vue`.
4. **Use existing UI components** — `v-modal`, `v-dropdown`, `v-icon-button`, `v-text-field`, `v-circular-progress`, etc. No custom styling when an existing component covers the need.
5. **No duplicate code** — extract shared logic into `src/hooks/` composables or `src/lib/` utilities.
6. **Pages only compose** — a view file imports composables + components, wires them together, nothing more.
7. **AI-friendly / token-efficient** — keep files small and focused so AI tools can read and modify them with minimal context.

## UI Component Rules

**No `confirm()`/`alert()`/`prompt()`** — Never use browser dialog methods. Use inline confirmation UI: replace the action button with confirm text + OK/Cancel buttons in place.

**Loading**: Use `<v-circular-progress indeterminate />`. Add `class="sm"` for inline use.

**Modals**: Use `<v-modal>` with slots `#headline`, `#content`, `#actions`. Use `<v-outlined-button>` for cancel, `<v-filled-button>` for primary actions.

**Dropdowns**: Use `<v-dropdown>` with `#trigger` slot + `.dropdown-item` children.

## Apollo & GraphQL Rules

**Frozen objects**: Always spread Apollo response objects before storing in Pinia or emitting — `{ ...r.data.item }` or `.map(x => ({ ...x }))`.

**initMutation**: Call at setup level, not inside handlers. Only accepts `{ document, options }` — no `variables`, `handle`, or `context`.

```typescript
const { mutate, onDone } = initMutation({ document: myGQL })
onDone((r) => { /* ... */ })
function handleClick() { mutate({ id }) }
```

## i18n

Locales are per-feature modules under `src/locales/<locale>/` (e.g. `bookmarks.ts`, `chat.ts`). `index.ts` auto-discovers siblings via `import.meta.glob`. Add new keys to the **appropriate module**.

**Sync translations** ("同步翻译"):
```bash
node scripts/i18n-find-untranslated.mjs   # detect missing keys
node scripts/i18n-translate-todo.mjs       # translate via Google Translate
node scripts/i18n-apply-todo.mjs           # apply to locale files
node scripts/i18n-find-untranslated.mjs    # verify: "Total: 0 missing, 0 untranslated"
```
## Rust / Tauri (`src-tauri/`) Dependency Rules

**Minimize third-party crates** — supply chain risk grows with every dependency.

1. **Write it yourself first** — if the logic is < ~50 lines of safe Rust (base64, hex, simple parsing), implement it inline rather than pulling a crate.
2. **Use official Tauri crates second** — prefer crates in the `tauri-apps` org (`tauri-plugin-http`, `tauri-plugin-websocket`, etc.) when a capability is already provided.
3. **Only add a third-party crate when unavoidable** — e.g. TLS/crypto where a battle-tested library is required for security correctness. Document the reason in a code comment.
4. **Allowed current crates** (in `src-tauri/Cargo.toml`):
   - `reqwest` (native-tls) — HTTPS to self-signed devices, uses macOS Security.framework
   - `tokio-tungstenite` (native-tls) — WSS to self-signed devices
   - `native-tls` — TLS connector construction
   - `futures-util` — async stream/sink traits required by tungstenite
   - `tokio` (sync + macros) — async channels and `select!`
5. **Never add** `serde_with`, `anyhow`, `thiserror`, `chrono`, `regex`, `rand`, or any crate that can be replaced by `std` or a short inline implementation.
6. **No Docker** — all build/conversion scripts run directly via `cargo` / `python3`.
