import { describe, it, expect } from 'vitest'
import {
  randomUUID,
  shortUUID,
  arrayBufferToHex,
  stringToArrayBuffer,
  base64ToArrayBuffer,
  arrayBufferToBase64,
  containsChinese,
  encodeBase64,
  decodeBase64,
} from '@/lib/strutil'

describe('randomUUID', () => {
  it('returns a string matching UUID v4 format', () => {
    const uuid = randomUUID()
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('generates unique values each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => randomUUID()))
    expect(ids.size).toBe(100)
  })

  it('version nibble is always 4', () => {
    for (let i = 0; i < 20; i++) {
      const uuid = randomUUID()
      expect(uuid[14]).toBe('4')
    }
  })

  it('variant nibble is 8, 9, a, or b', () => {
    const validVariants = new Set(['8', '9', 'a', 'b'])
    for (let i = 0; i < 20; i++) {
      const uuid = randomUUID()
      expect(validVariants.has(uuid[19])).toBe(true)
    }
  })

  it('total length is 36', () => {
    expect(randomUUID()).toHaveLength(36)
  })
})

describe('shortUUID', () => {
  it('returns a 22-character string', () => {
    expect(shortUUID()).toHaveLength(22)
  })

  it('uses only flickrBase58 alphabet characters', () => {
    const flickrBase58 = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
    const id = shortUUID()
    for (const char of id) {
      expect(flickrBase58).toContain(char)
    }
  })

  it('generates unique values each call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => shortUUID()))
    expect(ids.size).toBe(50)
  })

  it('does not contain hyphens', () => {
    expect(shortUUID()).not.toContain('-')
  })
})

describe('arrayBufferToHex', () => {
  it('converts empty buffer to empty string', () => {
    expect(arrayBufferToHex(new ArrayBuffer(0))).toBe('')
  })

  it('converts single zero byte to "00"', () => {
    const buf = new Uint8Array([0]).buffer
    expect(arrayBufferToHex(buf)).toBe('00')
  })

  it('converts [255] to "ff"', () => {
    const buf = new Uint8Array([255]).buffer
    expect(arrayBufferToHex(buf)).toBe('ff')
  })

  it('converts [1, 2, 3] to "010203"', () => {
    const buf = new Uint8Array([1, 2, 3]).buffer
    expect(arrayBufferToHex(buf)).toBe('010203')
  })

  it('returns lowercase hex', () => {
    const buf = new Uint8Array([0xab, 0xcd, 0xef]).buffer
    expect(arrayBufferToHex(buf)).toBe('abcdef')
  })

  it('pads single-digit hex values with leading zero', () => {
    const buf = new Uint8Array([0x0a]).buffer
    expect(arrayBufferToHex(buf)).toBe('0a')
  })
})

describe('stringToArrayBuffer', () => {
  it('converts ASCII string to Uint8Array', () => {
    const result = stringToArrayBuffer('ABC')
    expect(Array.from(result)).toEqual([65, 66, 67])
  })

  it('handles empty string', () => {
    expect(stringToArrayBuffer('')).toHaveLength(0)
  })

  it('each byte is the charCode of the corresponding character', () => {
    const str = 'hello'
    const arr = stringToArrayBuffer(str)
    for (let i = 0; i < str.length; i++) {
      expect(arr[i]).toBe(str.charCodeAt(i))
    }
  })
})

describe('base64ToArrayBuffer', () => {
  it('decodes a base64 string to Uint8Array', () => {
    const encoded = btoa('Hello')
    const result = base64ToArrayBuffer(encoded)
    expect(Array.from(result)).toEqual([72, 101, 108, 108, 111])
  })

  it('roundtrips with arrayBufferToBase64', () => {
    const original = new Uint8Array([10, 20, 30, 255])
    const b64 = arrayBufferToBase64(original.buffer)
    const back = base64ToArrayBuffer(b64)
    expect(Array.from(back)).toEqual(Array.from(original))
  })
})

describe('arrayBufferToBase64', () => {
  it('encodes Uint8Array to base64', () => {
    const buf = new Uint8Array([72, 101, 108, 108, 111]).buffer // "Hello"
    expect(arrayBufferToBase64(buf)).toBe(btoa('Hello'))
  })

  it('handles empty buffer', () => {
    expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('')
  })
})

describe('containsChinese', () => {
  it('returns true for a string with Chinese characters', () => {
    expect(containsChinese('你好')).toBe(true)
  })

  it('returns true for mixed Chinese-English string', () => {
    expect(containsChinese('hello你好')).toBe(true)
  })

  it('returns false for ASCII-only string', () => {
    expect(containsChinese('hello world')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(containsChinese('')).toBe(false)
  })

  it('returns false for Japanese hiragana (outside CJK unified range)', () => {
    // Hiragana is in 3040-309F, which is outside the 3400-9FBF range
    expect(containsChinese('ひらがな')).toBe(false)
  })
})

describe('encodeBase64', () => {
  it('encodes a simple ASCII string', () => {
    const result = encodeBase64('hello')
    expect(result).toBe(btoa(encodeURIComponent('hello')))
  })

  it('returns empty string for empty input', () => {
    expect(encodeBase64('')).toBe('')
  })

  it('returns empty string for null-like input', () => {
    expect(encodeBase64(null as any)).toBe('')
  })

  it('handles unicode/Chinese input', () => {
    const result = encodeBase64('你好')
    expect(result).toBeTruthy()
    // Should be decodable
    expect(decodeBase64(result)).toBe('你好')
  })
})

describe('decodeBase64', () => {
  it('decodes a base64-encoded ASCII string', () => {
    const encoded = encodeBase64('world')
    expect(decodeBase64(encoded)).toBe('world')
  })

  it('returns the original string on invalid base64 input', () => {
    const invalid = '!@#$not_valid_base64'
    expect(decodeBase64(invalid)).toBe(invalid)
  })

  it('decodes unicode correctly', () => {
    const encoded = encodeBase64('日本語テスト')
    expect(decodeBase64(encoded)).toBe('日本語テスト')
  })

  it('handles empty string', () => {
    expect(decodeBase64('')).toBe('')
  })
})
