/**
 * Cross-API integration test helpers.
 *
 * Sends the same GraphQL operations to both the plain-web Rust local
 * server and the plain-app Android HTTP server, then compares the
 * returned data structures and behaviors. plain-app is the source of
 * truth — any Rust-side divergence should surface as a test failure.
 *
 * Wire protocol mirrors `src/lib/api/gql-client.ts`:
 *   1. JSON.stringify({ query, variables })
 *   2. wrapWithReplayProtection → "TIMESTAMP|NONCE_HEX|JSON"
 *   3. XChaCha20-Poly1305 encrypt with the URL token (32 bytes, base64)
 *   4. POST /graphql, body = nonce(24) || ciphertext
 *   5. Decrypt response with the same key
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from '@noble/ciphers/webcrypto'

// Lowercase hex encoding — mirrors src/lib/strutil.ts::bytesToHex.
// Inlined (per AGENTS.md "minimize dependencies") so the integration
// test has zero `@/` imports and stays self-contained.
function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += (bytes[i] & 0xff).toString(16).padStart(2, '0')
  }
  return out
}

// ── Config ────────────────────────────────────────────────────────────────

export interface EndpointConfig {
  url: string
  token: string
  clientId: string
}

function readEnv(name: string): string {
  return (process.env[name] ?? '').trim()
}

function parseEndpoint(prefix: 'RUST' | 'ANDROID'): EndpointConfig | null {
  const url = readEnv(`${prefix}_API_URL`)
  const token = readEnv(`${prefix}_API_TOKEN`)
  const clientId = readEnv(`${prefix}_CLIENT_ID`) || 'integration-test'
  if (!url || !token) return null
  return { url, token, clientId }
}

export const rustEndpoint = parseEndpoint('RUST')
export const androidEndpoint = parseEndpoint('ANDROID')

/** Both endpoints configured — cross-API comparison tests can run. */
export const hasBothEndpoints = !!(rustEndpoint && androidEndpoint)

/** Reason used in `describe.skip` messages when config is missing. */
export const skipReason: string =
  !rustEndpoint && !androidEndpoint
    ? 'Neither RUST_API_* nor ANDROID_API_* env vars are set'
    : !rustEndpoint
      ? 'RUST_API_URL / RUST_API_TOKEN env vars are not set'
      : !androidEndpoint
        ? 'ANDROID_API_URL / ANDROID_API_TOKEN env vars are not set'
        : ''

// ── Crypto (mirrors src/lib/api/crypto.ts) ────────────────────────────────

function tokenToKey(token: string): Uint8Array {
  // The token is a base64-encoded 32-byte key. gql-client uses
  // `tokenToKey` which takes the first 32 ASCII chars; the Rust local
  // server derives the key from the raw 32-byte token. Both forms
  // agree when the token is exactly 32 bytes of base64 (44 chars).
  // For Android, the auth_token is already the raw 32-byte key
  // base64-encoded, so `atob` is correct.
  const raw = Buffer.from(token, 'base64')
  const key = new Uint8Array(32)
  key.set(raw.subarray(0, 32))
  return key
}

function chachaEncrypt(key: Uint8Array, plaintext: string): Uint8Array {
  const nonce = randomBytes(24)
  const cipher = xchacha20poly1305(key, nonce)
  const ciphertext = cipher.encrypt(new TextEncoder().encode(plaintext))
  const out = new Uint8Array(nonce.length + ciphertext.length)
  out.set(nonce, 0)
  out.set(ciphertext, nonce.length)
  return out
}

function chachaDecrypt(key: Uint8Array, data: Uint8Array): string {
  const nonce = data.slice(0, 24)
  const ciphertext = data.slice(24)
  const cipher = xchacha20poly1305(key, nonce)
  const plaintext = cipher.decrypt(ciphertext)
  return new TextDecoder().decode(plaintext)
}

// Mirrors src/lib/api/time-sync.ts::wrapWithReplayProtection.
// Format: "TIMESTAMP|NONCE_HEX|JSON"
function wrapWithReplayProtection(json: string): string {
  const timestamp = Date.now()
  const nonce = bytesToHex(randomBytes(16))
  return `${timestamp}|${nonce}|${json}`
}

// ── GraphQL client ────────────────────────────────────────────────────────

export interface GqlResponse<T = any> {
  data: T | null
  errors?: Array<{ message: string; path?: string[] }>
  status: number
  raw: string
}

/**
 * Send a GraphQL operation to the given endpoint. Throws on network
 * failure or non-200/401/403 status (matching gql-client semantics).
 */
export async function gqlFetch<T = any>(
  ep: EndpointConfig,
  query: string,
  variables?: Record<string, any>,
): Promise<GqlResponse<T>> {
  const url = `${ep.url.replace(/\/$/, '')}/graphql`
  const key = tokenToKey(ep.token)
  const json = JSON.stringify({ query, variables })
  const payload = wrapWithReplayProtection(json)
  const body = chachaEncrypt(key, payload)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
      'c-id': ep.clientId,
    },
    body: body as BodyInit,
  })

  if (response.status === 401) {
    throw new Error(`unauthorized (401) at ${ep.url}`)
  }
  if (response.status === 403) {
    throw new Error(`web_access_disabled (403) at ${ep.url}`)
  }
  if (!response.ok) {
    throw new Error(`unexpected status ${response.status} at ${ep.url}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const text = chachaDecrypt(key, new Uint8Array(arrayBuffer))
  let parsed: { data?: T; errors?: Array<{ message: string; path?: string[] }> }
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new Error(`failed to parse response from ${ep.url}: ${text.slice(0, 200)}`)
  }
  return {
    data: parsed.data ?? null,
    errors: parsed.errors,
    status: response.status,
    raw: text,
  }
}

/**
 * Send the same operation to both endpoints in parallel and return
 * both responses. Used by every cross-API test case.
 */
export async function gqlFetchBoth<T = any>(
  query: string,
  variables?: Record<string, any>,
): Promise<{ rust: GqlResponse<T>; android: GqlResponse<T> }> {
  if (!rustEndpoint || !androidEndpoint) {
    throw new Error('gqlFetchBoth called without both endpoints configured')
  }
  const [rust, android] = await Promise.all([
    gqlFetch<T>(rustEndpoint, query, variables),
    gqlFetch<T>(androidEndpoint, query, variables),
  ])
  return { rust, android }
}

// ── Structure comparison ──────────────────────────────────────────────────

/**
 * Assert that two values have the same key set and value types.
 * Used to verify cross-API schema alignment without depending on
 * specific data values (the two DBs have different contents).
 *
 * - For objects: compares sorted key arrays, then recurses.
 * - For arrays: if both are non-empty, compares the first element's
 *   shape; if both empty, passes; if lengths differ in emptiness,
 *   that's allowed (different DB states) — we sample whichever side
 *   has data.
 * - For primitives: compares `typeof`.
 * - `null` on either side is treated as "field absent" — useful for
 *   optional fields like ChatItem.data where one side may have it
 *   populated and the other not (different chat contents).
 */
export function assertSameShape(
  rustVal: any,
  androidVal: any,
  path = 'root',
  opts: { allowNullOnEitherSide?: boolean } = {},
): void {
  const { allowNullOnEitherSide = true } = opts

  // null vs null — fine
  if (rustVal === null || androidVal === null) {
    if (allowNullOnEitherSide) return
    if (rustVal !== androidVal) {
      throw new Error(`${path}: null mismatch (rust=${rustVal}, android=${androidVal})`)
    }
    return
  }

  const rType = typeof rustVal
  const aType = typeof androidVal
  if (rType !== aType) {
    throw new Error(`${path}: type mismatch (rust=${rType}, android=${aType})`)
  }

  // Arrays
  if (Array.isArray(rustVal) || Array.isArray(androidVal)) {
    if (!Array.isArray(rustVal) || !Array.isArray(androidVal)) {
      throw new Error(`${path}: array vs non-array (rust=${Array.isArray(rustVal)}, android=${Array.isArray(androidVal)})`)
    }
    // Different lengths are OK (different DB states). Only compare
    // shape if at least one side has data.
    const sample = rustVal[0] ?? androidVal[0]
    if (sample !== undefined) {
      const rustSample = rustVal[0] ?? sample
      const androidSample = androidVal[0] ?? sample
      assertSameShape(rustSample, androidSample, `${path}[0]`, opts)
    }
    return
  }

  // Primitives (string, number, boolean)
  if (rType !== 'object') return

  // Objects — compare key sets, then recurse.
  const rKeys = Object.keys(rustVal).sort()
  const aKeys = Object.keys(androidVal).sort()
  if (rKeys.join(',') !== aKeys.join(',')) {
    const missingInRust = aKeys.filter((k) => !rKeys.includes(k))
    const missingInAndroid = rKeys.filter((k) => !aKeys.includes(k))
    const parts: string[] = []
    if (missingInRust.length) parts.push(`missing in Rust: [${missingInRust.join(', ')}]`)
    if (missingInAndroid.length) parts.push(`missing in Android: [${missingInAndroid.join(', ')}]`)
    throw new Error(`${path}: key set mismatch — ${parts.join('; ')}`)
  }

  for (const key of rKeys) {
    assertSameShape(rustVal[key], androidVal[key], `${path}.${key}`, opts)
  }
}

/**
 * Convenience: fetch from both, assert no errors, assert the named
 * top-level data field has the same shape on both sides.
 */
export async function expectBothSameShape<T = any>(
  query: string,
  variables: Record<string, any> | undefined,
  dataPath: string,
): Promise<{ rust: T; android: T }> {
  const { rust, android } = await gqlFetchBoth<T>(query, variables)
  if (rust.errors) {
    throw new Error(`Rust returned GraphQL errors: ${JSON.stringify(rust.errors)}`)
  }
  if (android.errors) {
    throw new Error(`Android returned GraphQL errors: ${JSON.stringify(android.errors)}`)
  }
  const rustData = pathGet(rust.data, dataPath)
  const androidData = pathGet(android.data, dataPath)
  assertSameShape(rustData, androidData, dataPath)
  return { rust: rustData, android: androidData }
}

function pathGet(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
}

/**
 * Generate a unique channel/chat name for mutation tests so parallel
 * runs don't collide.
 */
export function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
