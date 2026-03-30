# Copilot Instructions for plain-web

> **Start here**: Read `docs/ARCHITECTURE.md` for project structure and directory map.

## Code Standards (MUST follow for ALL changes)

1. **Max 150 lines per file** — split into components/composables if exceeded.
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
