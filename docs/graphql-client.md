# GraphQL Client — Design & Usage

## Overview

A custom GraphQL client built on the Fetch API + Vue 3 reactivity. Replaces `@apollo/client` and `@vue/apollo-composable` with zero external dependencies (reuses existing `@noble/ciphers` for encryption).

All traffic is encrypted with **XChaCha20-Poly1305** and protected against replay attacks via timestamp nonces.

## Architecture

```
┌─────────────────────────────────────────┐
│  Component / Composable                 │
│  ┌──────────┐ ┌────────────┐            │
│  │ initQuery│ │initMutation│            │
│  └────┬─────┘ └─────┬──────┘            │
│       └──────┬───────┘                  │
│         gqlFetch()                      │
│       ┌──────┴───────┐                  │
│       │ encrypt body │                  │
│       │ fetch()      │                  │
│       │ decrypt resp │                  │
│       └──────────────┘                  │
└─────────────────────────────────────────┘
```

### Files

| File | Purpose |
|---|---|
| `src/lib/api/gql-client.ts` | Core `gqlFetch()` — encrypt, fetch, decrypt, parse |
| `src/lib/api/query.ts` | `initQuery`, `initLazyQuery` wrappers + all query string constants |
| `src/lib/api/mutation.ts` | `initMutation`, `runMutation` wrappers + all mutation string constants |
| `src/lib/api/fragments.ts` | Reusable GraphQL fragment strings |

### Key Design Decisions

1. **No client-side cache**: Every request goes to the server (`network-only` equivalent). The server is a local Android device, so latency is negligible. Reactive local state is managed via Vue `ref()` / Pinia stores.

2. **Plain strings for GQL**: No `graphql-tag` or AST parsing. Queries/mutations/fragments are template literal strings composed via `${fragment}` interpolation.

3. **No subscriptions**: Real-time events come through a separate WebSocket event bus (`mitt`). The GraphQL layer is request/response only.

4. **Unified error handling**: `GqlError` class with `status` code. `401` clears auth and reloads. `403` indicates access disabled. All other errors surface as toast messages.

## Usage

### Queries

```typescript
import { initQuery, myDataGQL } from '@/lib/api/query'

// Auto-executes immediately, re-fetches when variables change
const { loading, refetch } = initQuery({
  handle: (data, error) => {
    if (error) toast(t(error), 'error')
    else items.value = data.myItems
  },
  document: myDataGQL,
  variables: () => ({ id: someRef.value }),  // reactive
})
```

### Lazy Queries

```typescript
import { initLazyQuery, myDataGQL } from '@/lib/api/query'

// Only executes when fetch() is called
const { loading, fetch } = initLazyQuery({
  handle: (data, error) => { ... },
  document: myDataGQL,
  variables: () => ({ id: someRef.value }),
})

onMounted(() => fetch())
```

### Mutations

```typescript
import { initMutation, updateItemGQL } from '@/lib/api/mutation'

const { mutate, loading, onDone, onError } = initMutation({
  document: updateItemGQL,
})

onDone((result) => {
  // result is { data: { updateItem: { ... } } }
  items.value.push({ ...result.data.updateItem })
})

function handleClick() {
  mutate({ id: '123', input: { name: 'new' } })
}
```

### Direct Fetch

For one-off queries outside of Vue components (e.g. in utility functions):

```typescript
import { gqlFetch } from '@/lib/api/gql-client'
import { someGQL } from '@/lib/api/query'

const result = await gqlFetch(someGQL, { id: '123' })
// result is { data: T, errors?: [...] }
```

### Convenience: runMutation

For fire-and-forget mutations with error toast:

```typescript
import { runMutation, updateItemGQL, initMutation } from '@/lib/api/mutation'

const { mutate } = initMutation({ document: updateItemGQL })
await runMutation(mutate, { id, name })
```

## API Reference

### `gqlFetch<T>(query, variables?)`
- Returns `Promise<GqlResult<T>>` where `GqlResult = { data: T, errors?: [...] }`
- Throws `GqlError` on network/auth errors
- 30s timeout

### `initQuery<T>(params)`
- `params.handle(data: T, error: string)` — called on success/error
- `params.document: string` — GQL query string
- `params.variables?: () => Record | Record` — reactive or static
- Returns `{ loading: Ref<boolean>, result: Ref<T>, refetch }`

### `initLazyQuery<T>(params)`
- Same params as `initQuery`
- Returns `{ loading, result, fetch }` — call `fetch()` to execute

### `initMutation(params, handleError?)`
- `params.document: string` — GQL mutation string
- `handleError: boolean = true` — auto-toast on error
- Returns `{ mutate, loading, onDone, onError }`
- `mutate(variables)` returns the result on success, `undefined` on error
- `onDone(fn)` / `onError(fn)` — register callbacks, return `{ off }` to unregister

### `runMutation(mutate, variables?)`
- Calls `mutate(variables)`, returns result or `undefined`

## Adding New Queries/Mutations

1. Add the GQL string constant to `query.ts` or `mutation.ts`
2. Use fragment interpolation: `` `query { items { ...ItemFragment } } ${itemFragment}` ``
3. Export it
4. Import in your composable and use with `initQuery`/`initMutation`

## Event-Driven Updates (replacing Apollo Cache)

Instead of Apollo cache writes, use direct `ref` manipulation or emit events:

```typescript
// In mutation handler — direct ref update
onDone((r) => {
  items.value = [...items.value, { ...r.data.createItem }]
})

// For cross-component updates — event bus
import emitter from '@/plugins/eventbus'
emitter.emit('refetch_app')
```
