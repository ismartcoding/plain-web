import { describe, it, expect } from 'vitest'
import { sha512, hashToKey, chachaEncrypt, chachaDecrypt, arrayBufferToBitArray, bitArrayToUint8Array, bitArrayToBase64 } from '@/lib/api/crypto'

describe('sha512', () => {
  it('returns a 128-char hex string for empty string', () => {
    const result = sha512('')
    expect(result).toHaveLength(128)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  it('returns consistent output for same input', () => {
    expect(sha512('hello')).toBe(sha512('hello'))
  })

  it('returns different hashes for different inputs', () => {
    expect(sha512('hello')).not.toBe(sha512('world'))
  })

  it('returns a hex string for normal text', () => {
    const result = sha512('test input')
    expect(result).toMatch(/^[0-9a-f]{128}$/)
  })

  it('handles unicode input', () => {
    const result = sha512('你好世界')
    expect(result).toHaveLength(128)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  it('handles long string input', () => {
    const result = sha512('a'.repeat(10000))
    expect(result).toHaveLength(128)
  })
})

describe('hashToKey', () => {
  it('returns a Uint8Array of length 32', () => {
    const key = hashToKey('abcdef1234567890abcdef1234567890abcdef')
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key).toHaveLength(32)
  })

  it('uses first 32 chars of the hash as ASCII codepoints', () => {
    const hash = 'abcdef1234567890abcdef1234567890abcdef'
    const key = hashToKey(hash)
    for (let i = 0; i < 32; i++) {
      expect(key[i]).toBe(hash.charCodeAt(i))
    }
  })

  it('truncates hash to 32 bytes even if hash is longer', () => {
    const longHash = 'a'.repeat(128)
    const key = hashToKey(longHash)
    expect(key).toHaveLength(32)
    expect(key.every((b) => b === 'a'.charCodeAt(0))).toBe(true)
  })

  it('produces deterministic output for same input', () => {
    const hash = 'deadbeef00112233deadbeef00112233deadbeef'
    const k1 = hashToKey(hash)
    const k2 = hashToKey(hash)
    expect(Array.from(k1)).toEqual(Array.from(k2))
  })
})

describe('chachaEncrypt / chachaDecrypt roundtrip', () => {
  function makeKey(): Uint8Array {
    return hashToKey('a'.repeat(64))
  }

  it('decrypts back to original plaintext', () => {
    const key = makeKey()
    const plaintext = 'Hello, World!'
    const ciphertext = chachaEncrypt(key, plaintext)
    expect(chachaDecrypt(key, ciphertext)).toBe(plaintext)
  })

  it('encrypted output is longer than plaintext (nonce + tag overhead)', () => {
    const key = makeKey()
    const plaintext = 'test'
    const enc = chachaEncrypt(key, plaintext)
    // 24-byte nonce + 16-byte Poly1305 tag + plaintext bytes
    expect(enc.length).toBeGreaterThan(new TextEncoder().encode(plaintext).length + 24)
  })

  it('produces different ciphertext each call (random nonce)', () => {
    const key = makeKey()
    const enc1 = chachaEncrypt(key, 'same')
    const enc2 = chachaEncrypt(key, 'same')
    expect(Array.from(enc1)).not.toEqual(Array.from(enc2))
  })

  it('roundtrip with empty string', () => {
    const key = makeKey()
    const enc = chachaEncrypt(key, '')
    expect(chachaDecrypt(key, enc)).toBe('')
  })

  it('roundtrip with unicode input', () => {
    const key = makeKey()
    const text = '你好世界 🌍'
    const enc = chachaEncrypt(key, text)
    expect(chachaDecrypt(key, enc)).toBe(text)
  })

  it('roundtrip with JSON payload', () => {
    const key = makeKey()
    const json = JSON.stringify({ query: 'query { me { id } }', variables: { id: '123' } })
    const enc = chachaEncrypt(key, json)
    expect(chachaDecrypt(key, enc)).toBe(json)
  })

  it('roundtrip with long payload', () => {
    const key = makeKey()
    const text = 'x'.repeat(50000)
    const enc = chachaEncrypt(key, text)
    expect(chachaDecrypt(key, enc)).toBe(text)
  })

  it('throws when decrypting with wrong key', () => {
    const key1 = hashToKey('a'.repeat(64))
    const key2 = hashToKey('b'.repeat(64))
    const enc = chachaEncrypt(key1, 'secret')
    expect(() => chachaDecrypt(key2, enc)).toThrow()
  })

  it('throws when ciphertext is truncated', () => {
    const key = makeKey()
    const enc = chachaEncrypt(key, 'secret')
    expect(() => chachaDecrypt(key, enc.slice(0, 10))).toThrow()
  })
})

describe('arrayBufferToBitArray', () => {
  it('wraps ArrayBuffer into Uint8Array view', () => {
    const ab = new Uint8Array([1, 2, 3]).buffer
    const result = arrayBufferToBitArray(ab)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual([1, 2, 3])
  })

  it('handles empty ArrayBuffer', () => {
    const ab = new ArrayBuffer(0)
    expect(arrayBufferToBitArray(ab)).toHaveLength(0)
  })
})

describe('bitArrayToUint8Array', () => {
  it('returns the same Uint8Array (identity)', () => {
    const arr = new Uint8Array([10, 20, 30])
    const result = bitArrayToUint8Array(arr)
    expect(result).toBe(arr)
  })
})

describe('bitArrayToBase64', () => {
  it('encodes Uint8Array to base64 string', () => {
    const arr = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
    expect(bitArrayToBase64(arr)).toBe(btoa('Hello'))
  })

  it('handles empty array', () => {
    expect(bitArrayToBase64(new Uint8Array([]))).toBe('')
  })

  it('roundtrips via atob', () => {
    const arr = new Uint8Array([1, 2, 3, 255, 0, 128])
    const b64 = bitArrayToBase64(arr)
    const decoded = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    expect(Array.from(decoded)).toEqual(Array.from(arr))
  })
})
