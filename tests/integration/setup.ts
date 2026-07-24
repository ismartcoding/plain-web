/**
 * Setup for the `integration` vitest project (Node environment).
 *
 * Responsibilities:
 *   1. Load `.env.test.local` if present. The file holds
 *      RUST_API_URL / RUST_API_TOKEN / ANDROID_API_URL /
 *      ANDROID_API_TOKEN (+ optional *_CLIENT_ID). When the file is
 *      absent, env vars fall back to whatever the shell already
 *      exported — if neither source provides config, the test suites
 *      skip themselves via `describe.skipIf(hasBothEndpoints)`.
 *   2. Disable TLS certificate validation for the test process.
 *      The plain-app Android server uses a self-signed cert; Node's
 *      fetch rejects self-signed certs by default. Tests run in a
 *      dedicated worker thread (pool: 'threads', singleThread: true)
 *      so this does not leak into the `unit` / `cws` projects.
 */
import { beforeAll } from 'vitest'

// `.env.test.local` is gitignored — each developer maintains their own.
// Use Node's built-in env-file loader (Node 20.12+ / 22+).
try {
  process.loadEnvFile('.env.test.local')
} catch {
  // File missing — fall back to shell env vars. If those are also
  // missing, helpers.ts::hasBothEndpoints will be false and every
  // describe block will skip.
}

beforeAll(() => {
  // Disable TLS rejection for the duration of the test process.
  // Only affects the integration project's worker thread.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
})
