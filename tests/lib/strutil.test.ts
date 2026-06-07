import { describe, it, expect } from 'vitest'
import { bytesToHex, arrayBufferToHex } from '@/lib/strutil'

describe('bytesToHex', () => {
  it('encodes empty array', () => {
    expect(bytesToHex(new Uint8Array())).toBe('')
  })

  it('encodes full bytes with leading zero', () => {
    expect(bytesToHex(new Uint8Array([0x00, 0x01, 0x10, 0xff, 0xab]))).toBe('000110ffab')
  })

  it('preserves high nibble (regression: time-sync nonce bug)', () => {
    // (byte & 0x0f).toString(16) dropped the high nibble — e.g.
    // 0xff became "f" instead of "ff". bytesToHex must keep both.
    expect(bytesToHex(new Uint8Array([0xff]))).toBe('ff')
    expect(bytesToHex(new Uint8Array([0x10]))).toBe('10')
    expect(bytesToHex(new Uint8Array([0xab]))).toBe('ab')
  })

  it('encodes 16 random bytes deterministically', () => {
    const arr = Uint8Array.from({ length: 16 }, (_, i) => i * 17)
    // First few bytes: 0*17=0x00, 1*17=0x11, 2*17=0x22, 3*17=0x33, 4*17=0x44...
    expect(bytesToHex(arr)).toBe('00112233445566778899aabbccddeeff')
    expect(bytesToHex(arr)).toHaveLength(32)
  })
})

describe('arrayBufferToHex', () => {
  it('matches bytesToHex over the same bytes', () => {
    const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer
    expect(arrayBufferToHex(buf)).toBe('deadbeef')
  })
})
