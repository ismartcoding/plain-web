# Copilot Instructions for plain-web

> **Start here**: Read `docs/ARCHITECTURE.md` for project structure and directory map.

## UI Component Rules

**Loading**: Use `<v-circular-progress indeterminate />`. Add `class="sm"` for inline use. Never use `<i-lucide:loader-circle class="spin" />`.

**Modals**: Use `<v-modal>` with slots `#headline`, `#content`, `#actions`. Never build custom modal overlays with raw divs/positioning. Use `<v-outlined-button>` for cancel, `<v-filled-button>` for primary actions.

```vue
<v-modal @close="$emit('close')">
  <template #headline>{{ $t('title') }}</template>
  <template #content><!-- form --></template>
  <template #actions>
    <v-outlined-button @click="$emit('close')">{{ $t('cancel') }}</v-outlined-button>
    <v-filled-button :loading="saving" @click="save">{{ $t('save') }}</v-filled-button>
  </template>
</v-modal>
```

**Dropdowns**: Use `<v-dropdown>` with `#trigger` slot + `.dropdown-item` children. Never write bespoke popover HTML.

## Apollo & GraphQL Rules

**Frozen objects**: Always spread Apollo response objects before storing in Pinia or emitting — `{ ...r.data.item }` or `.map(x => ({ ...x }))`. Apollo objects are frozen and non-extensible.

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
