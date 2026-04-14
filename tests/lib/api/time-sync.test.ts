import { describe, it, expect } from 'vitest'
import { wrapWithReplayProtection } from '@/lib/api/time-sync'

describe('wrapWithReplayProtection', () => {
  it('returns a string with exactly two pipe separators', () => {
    const result = wrapWithReplayProtection('{"query":"{}"}')
    const parts = result.split('|')
    expect(parts).toHaveLength(3)
  })

  it('first segment is a numeric timestamp', () => {
    const result = wrapWithReplayProtection('{}')
    const [ts] = result.split('|')
    expect(Number(ts)).toBeGreaterThan(0)
    expect(Number.isFinite(Number(ts))).toBe(true)
  })

  it('timestamp is recent (within 5 seconds of now)', () => {
    const before = Date.now()
    const result = wrapWithReplayProtection('{}')
    const after = Date.now()
    const ts = Number(result.split('|')[0])
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('second segment is a 16-char lowercase hex nonce', () => {
    const result = wrapWithReplayProtection('{}')
    const nonce = result.split('|')[1]
    expect(nonce).toHaveLength(16)
    expect(nonce).toMatch(/^[0-9a-f]{16}$/)
  })

  it('nonce is different across calls (probabilistic)', () => {
    const nonce1 = wrapWithReplayProtection('{}').split('|')[1]
    const nonce2 = wrapWithReplayProtection('{}').split('|')[1]
    // Extremely unlikely to collide
    expect(nonce1).not.toBe(nonce2)
  })

  it('third segment is the original json unchanged', () => {
    const json = '{"query":"query { me { id } }","variables":{"id":"1"}}'
    const result = wrapWithReplayProtection(json)
    const parts = result.split('|')
    // Rejoin from index 2 in case json itself contains |
    expect(parts.slice(2).join('|')).toBe(json)
  })

  it('handles json containing pipe characters', () => {
    const json = 'a|b|c'
    const result = wrapWithReplayProtection(json)
    const parts = result.split('|')
    // Only first two parts are timestamp and nonce; rest is the json
    expect(parts.slice(2).join('|')).toBe(json)
  })

  it('handles empty string json', () => {
    const result = wrapWithReplayProtection('')
    const parts = result.split('|')
    expect(parts[2]).toBe('')
  })

  it('produces different wrapped strings each call', () => {
    const r1 = wrapWithReplayProtection('{"q":"x"}')
    const r2 = wrapWithReplayProtection('{"q":"x"}')
    // Nonces differ
    expect(r1).not.toBe(r2)
  })
})
