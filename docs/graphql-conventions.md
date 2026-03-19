# GraphQL Conventions & Chat Refactoring Plan

> Standardize GraphQL usage across all pages. Apply these rules to new code and migrate existing code incrementally.

## GraphQL Usage Rules

### 1. Queries — use `initQuery` / `initLazyQuery`

```typescript
// ✅ Standard query (auto-fetches on mount, re-fetches on variable change)
const { loading, refetch } = initQuery({
  handle: (data, error) => {
    if (error) { toast(t(error), 'error'); return }
    items.value = data.items
  },
  document: myQueryGQL,
  variables: () => ({ id: someId.value }),
})

// ✅ Lazy query (fetches on demand)
const { fetch, loading } = initLazyQuery({
  handle: (data) => { if (data?.items) items.value = data.items },
  document: myQueryGQL,
  variables: () => ({}),
})
onMounted(() => fetch())
```

### 2. Mutations — use `initMutation` at setup level

**Rule**: Call `initMutation()` at the top of `<script setup>` or composable setup. Never inside event handlers.

```typescript
// ✅ Correct: setup-level init, handler calls mutate()
const { mutate, loading, onDone } = initMutation({ document: myGQL })
onDone((result) => { /* handle success */ })
function handleClick() { mutate({ id }) }

// ❌ Wrong: initMutation inside a handler
function handleClick() {
  const { mutate } = initMutation({ document: myGQL }) // BAD
  mutate({ id })
}
```

### 3. Mutation Result Handling — prefer `onDone` callbacks

Use `onDone` for single-fire mutations. Avoid `.then()` on `mutate()`.

```typescript
// ✅ Preferred: onDone callback
const { mutate, onDone } = initMutation({ document: deleteGQL })
onDone(() => { toast(t('deleted')) })
function doDelete(id: string) { mutate({ id }) }

// ⚠️ Acceptable: await for sequential operations
async function doSequential() {
  await mutateA({ id: '1' })
  await mutateB({ id: '2' })  // depends on A completing first
}

// ❌ Avoid: .then() chains
mutate({ id }).then(() => { ... })  // use onDone instead
```

### 4. Cache Operations — centralized helpers

Use `insertCache`, `updateCache`, `deleteCache` from `@/lib/api/mutation` for list-level cache updates. Use `cache.evict()` for removal by identity.

```typescript
// ✅ Insert into a cached list query
const { mutate } = initMutation({
  document: createItemGQL,
  options: {
    update: (cache: ApolloCache<any>, result: any) => {
      insertCache(cache, result.data.createItem, itemsGQL, { filter: currentFilter.value })
    },
  },
})

// ✅ Evict a single item (e.g., after delete)
cache.evict({ id: cache.identify({ __typename: 'ChatItem', id: deletedId }) })

// ✅ Replace an entire cached list (e.g., on clear)
cache.writeQuery({
  query: itemsGQL,
  variables: { id: chatId },
  data: { chatItems: [] },
})
```

### 5. Direct Apollo Client — only for async contexts outside setup

`apollo.a.mutate()` is acceptable **only** when `useMutation` cannot be used (e.g., inside non-setup async tasks like `useTasks` upload finalization). Document why.

```typescript
// ✅ Acceptable: async task outside component setup
// useTasks runs outside Vue setup context, so direct client is needed
const res = await apollo.a.mutate({ mutation: sendChatItemGQL, variables: { ... } })
```

### 6. Event Bus + Cache Updates

For real-time events (WebSocket → event bus → cache), update the Apollo cache directly. Do NOT re-fetch queries. Prefer `insertCache`, `cache.evict()`, `cache.writeFragment()`.

```typescript
emitter.on('message_created', (items) => {
  const cache = apolloClient.cache
  const newItems = deduplicateAgainstCache(cache, items, query, variables)
  if (newItems.length) insertCache(cache, newItems, query, variables)
})
```

## `runMutation` — Promise wrapper (use sparingly)

`runMutation()` wraps the `onDone`/`onError` callback-style into a `Promise<boolean>`. Use only when you need to `await` a mutation result in sequential logic and `await mutate()` doesn't give you what you need.

---

## Chat Refactoring — File Map

### Before (ChatView.vue ~350 lines, all logic inline)

```
src/views/chat/ChatView.vue     # Everything: queries, mutations, cache, events, upload, UI
src/hooks/chat.ts               # Upload task queue only
```

### After (each file ≤ 150 lines)

```
src/hooks/chat-route.ts         # useChatRouteId() — decrypt route param → chatId/peerId/channelId
src/hooks/chat-messages.ts      # useChatMessages() — load, send, delete, real-time event handlers
src/hooks/chat-upload.ts        # useChatUpload() — file/image upload, progress tracking
src/hooks/chat-data.ts          # useChatData() — load peers/channels, name resolution
src/hooks/chat.ts               # useTasks() — upload task queue (unchanged)

src/views/chat/ChatView.vue     # Compose hooks + render (≤ 120 lines)
src/views/chat/ChatMessageItem.vue  # Single message bubble with dropdown
```

### Composable Responsibilities

| Composable | Owns | Returns |
|------------|------|---------|
| `useChatRouteId` | Route decryption | `chatId, peerId, channelId, isChannel, routeId` |
| `useChatData` | Peers/channels queries, event bus | `peers, channels, peer, channel, pageTitle, getSenderName` |
| `useChatMessages` | chatItems query, send/delete mutations, event bus handlers, cache ops | `chatItems, loading, sendLoading, send, deleteMessage, clearMessages, refetch, scrollContainer` |
| `useChatUpload` | Upload flow, progress aggregation | `doUploadFiles, doUploadImages, sendingAgg, downloadProgress` |

### Migration Checklist (other pages)

Apply these same patterns to:
- [ ] `NotesPage.vue` — extract `useNotesCrud` composable
- [ ] `FeedEntriesView.vue` — extract `useFeedEntries` composable
- [ ] `FilesView.vue` — already uses hooks, verify cache patterns
- [ ] `BookmarksView.vue` — verify `initMutation` is at setup level
- [ ] All modals — ensure `initMutation` at setup level, use `onDone`
