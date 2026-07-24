/**
 * Group 4 — Pairing schema alignment.
 *
 * Verifies that both servers expose the same pairing mutation NAMES
 * and accept the same input type shapes. Does NOT actually trigger
 * pairing — sends empty/placeholder inputs that fail at schema
 * validation (before the resolver runs), so no UDP packets are sent.
 *
 * plain-app (Android) is the source of truth. The frontend's
 * src/lib/api/mutation.ts uses the Android names (`cancelPairing`,
 * `respondToPairing`); if the Rust local server exposes different
 * names, the web client cannot drive pairing against it.
 *
 * Known divergences this test is designed to surface:
 *   - Rust exposes `cancelPairDevice` (should be `cancelPairing`)
 *   - Rust exposes `respondPairDevice` (should be `respondToPairing`)
 */
import { describe, it, expect } from 'vitest'
import {
  hasBothEndpoints,
  skipReason,
  gqlFetchBoth,
} from './helpers'

/** Check if a GraphQL error list mentions "unknown" field/mutation. */
function isUnknownFieldError(errors?: Array<{ message: string }>): boolean {
  if (!errors) return false
  return errors.some((e) => /unknown|cannot query|did you mean/i.test(e.message))
}

describe.skipIf(!hasBothEndpoints)(`pairing schema alignment — ${skipReason || 'both endpoints configured'}`, () => {
  // 4.1 pairDevice mutation exists on both.
  // Why: this is the entry point for initiating pairing. Both servers
  // must expose `mutation pairDevice(input: PairingDeviceInput!)`.
  // Sending `input: {}` triggers schema validation (missing required
  // fields) BEFORE the resolver — so no UDP PAIR_REQUEST is sent.
  // The error must be about missing fields, NOT about the mutation
  // being unknown.
  it('pairDevice mutation exists on both (input:{} → missing-field errors, not unknown-mutation)', async () => {
    const mutation = `
      mutation($input: PairingDeviceInput!) {
        pairDevice(input: $input)
      }
    `
    const { rust, android } = await gqlFetchBoth<{ pairDevice: boolean }>(mutation, {
      input: {},
    })
    // Both must reject the empty input (required fields missing)...
    expect(rust.errors, 'Rust should report validation errors for empty input').toBeDefined()
    expect(android.errors, 'Android should report validation errors for empty input').toBeDefined()
    // ...but neither should say the mutation is unknown.
    expect(isUnknownFieldError(rust.errors), `Rust: ${JSON.stringify(rust.errors)}`).toBe(false)
    expect(isUnknownFieldError(android.errors), `Android: ${JSON.stringify(android.errors)}`).toBe(false)
  })

  // 4.2 cancelPairing mutation name.
  // Why: the frontend calls `cancelPairing(deviceId)` (see
  // src/lib/api/mutation.ts:802). Android exposes this name. Rust
  // currently exposes `cancelPairDevice` instead — this test will
  // FAIL on Rust until the mutation is renamed.
  //
  // `deviceId: "__test__"` is a no-op on Android
  // (NearbyViewModel.cancelPairing cancels nothing for an unknown id),
  // so no UDP PAIR_CANCEL is sent.
  it('cancelPairing mutation name accepted by both (Rust currently fails — has cancelPairDevice)', async () => {
    const mutation = `
      mutation($deviceId: String!) {
        cancelPairing(deviceId: $deviceId)
      }
    `
    const { rust, android } = await gqlFetchBoth<{ cancelPairing: boolean }>(mutation, {
      deviceId: '__test_no_op__',
    })
    // Android must accept the mutation name.
    expect(isUnknownFieldError(android.errors), `Android: ${JSON.stringify(android.errors)}`).toBe(false)
    // Rust must ALSO accept the mutation name — currently does NOT.
    expect(isUnknownFieldError(rust.errors), `Rust: ${JSON.stringify(rust.errors)}`).toBe(false)
  })

  // 4.3 respondToPairing mutation name.
  // Why: the frontend calls `respondToPairing(input, accepted)` (see
  // src/lib/api/mutation.ts:808). Android exposes this name. Rust
  // currently exposes `respondPairDevice` — this test will FAIL on
  // Rust until the mutation is renamed.
  //
  // `input: {}` fails schema validation before the resolver, so no
  // UDP PAIR_RESPONSE is sent.
  it('respondToPairing mutation name accepted by both (Rust currently fails — has respondPairDevice)', async () => {
    const mutation = `
      mutation($input: PairingRequestInput!, $accepted: Boolean!) {
        respondToPairing(input: $input, accepted: $accepted)
      }
    `
    const { rust, android } = await gqlFetchBoth<{ respondToPairing: boolean }>(mutation, {
      input: {},
      accepted: false,
    })
    expect(isUnknownFieldError(android.errors), `Android: ${JSON.stringify(android.errors)}`).toBe(false)
    expect(isUnknownFieldError(rust.errors), `Rust: ${JSON.stringify(rust.errors)}`).toBe(false)
  })

  // 4.4 PairingDeviceInput required fields — both must require the
  // same set. Send an input missing `port` and verify both report it
  // as a missing required field (not "unknown field").
  // Why: if one server makes `port` optional and the other requires
  // it, the frontend can't send a single consistent request. The
  // required field set must match exactly.
  it('PairingDeviceInput: both reject input missing required `port` field', async () => {
    const mutation = `
      mutation($input: PairingDeviceInput!) {
        pairDevice(input: $input)
      }
    `
    // Provide all fields EXCEPT port — both should complain about port.
    const input = {
      id: 'test',
      name: 'test',
      deviceType: 'phone',
      version: '1.0',
      platform: 'android',
      lastSeen: new Date().toISOString(),
    }
    const { rust, android } = await gqlFetchBoth<{ pairDevice: boolean }>(mutation, { input })
    expect(rust.errors, 'Rust should report missing port').toBeDefined()
    expect(android.errors, 'Android should report missing port').toBeDefined()
    // Neither should report "unknown field" — the input type is recognized.
    expect(isUnknownFieldError(rust.errors), `Rust: ${JSON.stringify(rust.errors)}`).toBe(false)
    expect(isUnknownFieldError(android.errors), `Android: ${JSON.stringify(android.errors)}`).toBe(false)
    // Both should mention `port` in the error.
    const rustMentionsPort = rust.errors!.some((e) => /port/i.test(e.message))
    const androidMentionsPort = android.errors!.some((e) => /port/i.test(e.message))
    expect(rustMentionsPort, `Rust error should mention port: ${JSON.stringify(rust.errors)}`).toBe(true)
    expect(androidMentionsPort, `Android error should mention port: ${JSON.stringify(android.errors)}`).toBe(true)
  })

  // 4.5 PairingRequestInput required fields — both must require
  // `ecdhPublicKey`. Send an input missing it and verify both report
  // it as missing.
  // Why: the ECDH public key is essential for the pairing handshake.
  // If one server makes it optional, a malformed request could crash
  // the responder.
  it('PairingRequestInput: both reject input missing required `ecdhPublicKey`', async () => {
    const mutation = `
      mutation($input: PairingRequestInput!, $accepted: Boolean!) {
        respondToPairing(input: $input, accepted: $accepted)
      }
    `
    // Provide all required fields EXCEPT ecdhPublicKey.
    const input = {
      fromId: 'test',
      fromName: 'test',
      port: 8443,
      deviceType: 'phone',
      signaturePublicKey: 'test',
      timestamp: Date.now(),
    }
    const { rust, android } = await gqlFetchBoth<{ respondToPairing: boolean }>(mutation, {
      input,
      accepted: false,
    })
    expect(rust.errors, 'Rust should report missing ecdhPublicKey').toBeDefined()
    expect(android.errors, 'Android should report missing ecdhPublicKey').toBeDefined()
    expect(isUnknownFieldError(rust.errors), `Rust: ${JSON.stringify(rust.errors)}`).toBe(false)
    expect(isUnknownFieldError(android.errors), `Android: ${JSON.stringify(android.errors)}`).toBe(false)
    const rustMentionsKey = rust.errors!.some((e) => /ecdh/i.test(e.message))
    const androidMentionsKey = android.errors!.some((e) => /ecdh/i.test(e.message))
    expect(rustMentionsKey, `Rust error should mention ecdh: ${JSON.stringify(rust.errors)}`).toBe(true)
    expect(androidMentionsKey, `Android error should mention ecdh: ${JSON.stringify(android.errors)}`).toBe(true)
  })
})
