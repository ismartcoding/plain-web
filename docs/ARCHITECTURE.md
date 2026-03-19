# plain-web Architecture

> **Purpose**: AI-friendly project map. Read this first to avoid blind searching.

## Quick Facts

| Item | Value |
|------|-------|
| Framework | Vue 3.5 + Composition API |
| Bundler | Vite 5.4 |
| Language | TypeScript 5.8 |
| State | Pinia 3.0 |
| API | Apollo Client (GraphQL over HTTP/WebSocket) |
| i18n | vue-i18n 11 (per-feature module files) |
| Styling | SCSS (no CSS framework) |
| Encryption | XChaCha20-Poly1305 (`@noble/ciphers`) |
| Package manager | Yarn 4 |
| Dev server | `yarn dev` → localhost:3000 |

## Directory Map

```
src/
├── main.ts                    # App bootstrap
├── App.vue                    # Root component
├── components/
│   ├── base/                  # V-prefixed Material Design primitives
│   │   ├── VModal.vue         # Modal (teleport, focus trap, ESC close)
│   │   ├── VTextField.vue     # Text input
│   │   ├── VSelect.vue        # Select dropdown
│   │   ├── VCheckbox.vue      # Checkbox
│   │   ├── VDropdown.vue      # Dropdown menu
│   │   ├── VCircularProgress  # Loading spinner
│   │   ├── VFilledButton.vue  # Primary action button
│   │   ├── VOutlinedButton    # Secondary action button
│   │   ├── VIconButton.vue    # Icon-only button
│   │   └── ...                # VChipSet, VFilterChip, VInputChip
│   ├── {feature}/             # Feature-specific components
│   │   ├── chat/              # Chat components
│   │   ├── feeds/             # RSS feed components
│   │   ├── files/             # File browser components
│   │   ├── notes/             # Notes editor components
│   │   ├── audio/             # Audio player components
│   │   ├── images/            # Image gallery components
│   │   ├── videos/            # Video gallery components
│   │   ├── messages/          # SMS/MMS components
│   │   ├── contacts/          # Contact components
│   │   ├── calls/             # Call log components
│   │   ├── apps/              # App management components
│   │   ├── bookmark/          # Bookmark components
│   │   └── contextmenu/       # Context menu system
│   └── *.vue                  # Shared components (modals, toolbar, sidebar)
│
├── views/                     # Route-level page components
│   ├── HomeView.vue           # Dashboard
│   ├── LoginView.vue          # Authentication
│   ├── MainView.vue           # Layout shell
│   ├── ScreenMirrorView.vue   # WebRTC screen mirror
│   └── {feature}/             # Feature pages (audios/, chat/, feeds/, etc.)
│
├── hooks/                     # Composable functions
│   ├── chat.ts                # Chat upload task queue
│   ├── chat-route.ts          # Chat route ID decryption
│   ├── chat-data.ts           # Chat peers/channels loading
│   ├── chat-messages.ts       # Chat message CRUD + cache
│   ├── chat-upload.ts         # Chat file/image upload + progress
│   ├── chat-events.ts         # Chat real-time event bus handlers
│   ├── feeds.ts               # RSS subscriptions
│   ├── files.ts               # File operations
│   ├── notes.ts               # Note CRUD
│   ├── tags.ts                # Tagging system
│   ├── search.ts              # Search & filtering
│   ├── media.ts               # Media operations
│   ├── upload.ts              # File upload
│   ├── key-events.ts          # Keyboard shortcuts
│   └── ...                    # audios, contacts, device, sidebar, etc.
│
├── stores/                    # Pinia stores
│   ├── main.ts                # App-wide state
│   ├── files.ts               # File browser state
│   ├── bookmarks.ts           # Bookmarks state
│   └── temp.ts                # Ephemeral state
│
├── lib/                       # Utility modules
│   ├── api/                   # GraphQL queries & mutations (GQL documents)
│   ├── agent/                 # Server agent detection
│   ├── upload/                # Upload queue logic
│   ├── shortcuts/             # Keyboard shortcut definitions
│   ├── search.ts              # Search tokenizer & parser
│   ├── file.ts                # File helpers
│   ├── format.ts              # Formatting (dates, sizes)
│   ├── tag.ts                 # Tag helpers
│   ├── webrtc-client.ts       # WebRTC connection manager
│   └── ...                    # strutil, validator, theme, etc.
│
├── plugins/                   # Vue plugin setup
│   ├── apollo.ts              # Apollo Client config
│   ├── router.ts              # Vue Router routes
│   ├── i18n.ts                # vue-i18n initialization
│   └── ...                    # eventbus, tooltip, ripple, etc.
│
├── locales/                   # i18n translations (17 languages)
│   └── en-US/                 # English — per-feature modules
│       ├── index.ts           # Auto-merges siblings via import.meta.glob
│       ├── common.ts          # Generic UI strings
│       ├── chat.ts            # Chat strings
│       ├── files.ts           # File browser strings
│       └── ...                # feeds, media, bookmarks, etc.
│
├── types/                     # TypeScript type definitions
└── styles/                    # Global SCSS styles
```

## Data Flow

```
Vue Component → Composable Hook → Apollo (GraphQL) → Ktor Server on Android device
                     ↕                    ↕
               Pinia Store          WebSocket subscriptions
```

- **Queries/Mutations**: Via `@vue/apollo-composable` (`useQuery`, `useMutation`)
- **Custom wrapper**: `initMutation()` / `initQuery()` in hooks
- **Real-time**: GraphQL subscriptions over WebSocket
- **State**: Pinia for cross-component state; `ref`/`reactive` for local state

## Build Commands

```bash
yarn dev          # Dev server (port 3000)
yarn build        # Production build → dist/
yarn lint         # ESLint
yarn typecheck    # TypeScript check
```
