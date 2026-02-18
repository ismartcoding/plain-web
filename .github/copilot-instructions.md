# Copilot Instructions for plain-web

## UI Component Conventions

### Loading State
Always use `<v-circular-progress>` for loading indicators. Never use custom spinner markup such as `<i-lucide:loader-circle class="spin" />` with a CSS `@keyframes spin` animation.

```vue
<!-- ✅ Correct -->
<div v-if="loading" class="loading-state">
  <v-circular-progress indeterminate class="sm" />
</div>

<!-- ❌ Avoid -->
<div v-if="loading" class="loading-state">
  <i-lucide:loader-circle class="spin" />
</div>
```

The `class="sm"` modifier renders a smaller spinner suitable for inline or panel use. Omit it for full-page loading states.

---

### Modals
Always use `<v-modal>` with its named slots. Never build custom modal overlays using raw `<div>` with fixed/absolute positioning, backdrop divs, or manual z-index stacking.

```vue
<!-- ✅ Correct -->
<v-modal @close="$emit('close')">
  <template #headline>{{ $t('modal_title') }}</template>
  <template #content>
    <!-- form fields, v-text-field, v-select, etc. -->
  </template>
  <template #actions>
    <v-outlined-button @click="$emit('close')">{{ $t('cancel') }}</v-outlined-button>
    <v-filled-button :loading="saving" :disabled="!isValid" @click="save">
      {{ $t('save') }}
    </v-filled-button>
  </template>
</v-modal>

<!-- ❌ Avoid -->
<div class="modal-backdrop" @click="$emit('close')">
  <div class="modal-container" @click.stop>
    ...
  </div>
</div>
```

`<v-modal>` handles:
- `<teleport to="body">` mounting
- ESC key to close
- Backdrop click to close
- Focus trap

Slot summary:
| Slot | Purpose |
|------|---------|
| `#headline` | Modal title |
| `#content` | Body / form content |
| `#actions` | Footer buttons (right-aligned) |

Use `<v-outlined-button>` for cancel/secondary actions and `<v-filled-button>` for primary/confirm actions inside `#actions`.

---

### Dropdowns / Sort Menus
Use `<v-dropdown>` with a `#trigger` slot and `.dropdown-item` children. Never write bespoke popover/menu HTML.

```vue
<v-dropdown v-model="menuVisible">
  <template #trigger>
    <v-icon-button v-tooltip="$t('sort')">
      <i-material-symbols:sort-rounded />
    </v-icon-button>
  </template>
  <div class="dropdown-item" @click="setSortOrder('AZ')">{{ $t('bookmark_sort_az') }}</div>
  <div class="dropdown-item" @click="setSortOrder('RECENT_CLICK')">{{ $t('bookmark_sort_recent') }}</div>
</v-dropdown>
```

---

### Apollo Response Objects
Apollo freezes (makes non-extensible) all response objects. Before storing them in a Pinia store or passing them as Vue reactive props, always spread them into plain objects to avoid "Cannot add property, object is not extensible" runtime errors.

```typescript
// ✅ Correct — spread to create plain extensible copies
onDone((r: any) => {
  emit('saved', r.data.addBookmarks.map((b: any) => ({ ...b })))
})

// For a single object:
onDone((r: any) => {
  emit('saved', { ...r.data.updateBookmark })
})

// ❌ Avoid — passing frozen Apollo objects directly
onDone((r: any) => {
  emit('saved', r.data.addBookmarks)
})
```

---

### initMutation Pattern
Call `initMutation()` at **setup level** (not inside event handlers). Destructure `mutate` and call it inside the handler.

```typescript
// ✅ Correct
const { mutate: mutateDelete, loading: deleteLoading, onDone: onDeleteDone } = initMutation({
  document: deleteBookmarksGQL,
})

onDeleteDone(() => { /* ... */ })

function handleDelete(ids: string[]) {
  mutateDelete({ ids })
}

// ❌ Avoid — calling initMutation inside a function
function handleDelete(ids: string[]) {
  const { mutate } = initMutation({ document: deleteBookmarksGQL }) // wrong
  mutate({ ids })
}
```

`InitMutationParams` only accepts `{ document, options }`. Do not pass `variables`, `handle`, or `context` to `initMutation`.
