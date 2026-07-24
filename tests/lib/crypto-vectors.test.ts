import { describe, it, expect } from 'vitest'
import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { sha256 } from '@noble/hashes/sha2.js'
import { p256 } from '@noble/curves/nist.js'
import { ed25519 } from '@noble/curves/ed25519.js'
import { bytesToHex } from '@/lib/strutil'
import { chachaDecrypt } from '@/lib/api/crypto'
import vectors from '../fixtures/crypto-vectors.json'

const b64ToBytes = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

const bytesToB64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

// ── XChaCha20-Poly1305 ────────────────────────────────────────────────────────

describe('XChaCha20-Poly1305 — plain-app vectors', () => {
  const v = vectors.xchacha20
  const key = b64ToBytes(v.key)
  const nonce = b64ToBytes(v.nonce)
  const ciphertext = b64ToBytes(v.ciphertext)

  it('key is 32 bytes', () => {
    expect(key).toHaveLength(32)
  })

  it('nonce is 24 bytes', () => {
    expect(nonce).toHaveLength(24)
  })

  it('ciphertext length = plaintext length + 16-byte Poly1305 tag', () => {
    expect(ciphertext).toHaveLength(utf8(v.plaintext).length + 16)
  })

  it('decrypts plain-app ciphertext to the expected plaintext (@noble/ciphers)', () => {
    const cipher = xchacha20poly1305(key, nonce)
    const plaintext = cipher.decrypt(ciphertext)
    expect(new TextDecoder().decode(plaintext)).toBe(v.plaintext)
  })

  it('decrypts plain-app ciphertext via web chachaDecrypt (nonce || ciphertext blob)', () => {
    const blob = new Uint8Array(nonce.length + ciphertext.length)
    blob.set(nonce, 0)
    blob.set(ciphertext, nonce.length)
    expect(chachaDecrypt(key, blob)).toBe(v.plaintext)
  })

  it('re-encrypting with the same key+nonce produces the same ciphertext', () => {
    const cipher = xchacha20poly1305(key, nonce)
    const reEncrypted = cipher.encrypt(utf8(v.plaintext))
    expect(Array.from(reEncrypted)).toEqual(Array.from(ciphertext))
  })
})

// ── Ed25519 ──────────────────────────────────────────────────────────────────

describe('Ed25519 — plain-app vectors', () => {
  const v = vectors.ed25519
  const privateKey = b64ToBytes(v.privateKey)
  const publicKey = b64ToBytes(v.publicKey)
  const signature = b64ToBytes(v.signature)
  const message = utf8(v.message)

  it('private key is 32 bytes', () => {
    expect(privateKey).toHaveLength(32)
  })

  it('public key is 32 bytes', () => {
    expect(publicKey).toHaveLength(32)
  })

  it('signature is 64 bytes', () => {
    expect(signature).toHaveLength(64)
  })

  it('verifies plain-app signature with @noble/curves', () => {
    expect(ed25519.verify(signature, message, publicKey)).toBe(true)
  })

  it('derives the same public key from the private key', () => {
    const derivedPub = ed25519.getPublicKey(privateKey)
    expect(Array.from(derivedPub)).toEqual(Array.from(publicKey))
  })

  it('signing the same message with the same key produces the same signature', () => {
    const reSigned = ed25519.sign(message, privateKey)
    expect(Array.from(reSigned)).toEqual(Array.from(signature))
  })

  it('rejects a tampered signature', () => {
    const tampered = new Uint8Array(signature)
    tampered[0] ^= 0x01
    expect(ed25519.verify(tampered, message, publicKey)).toBe(false)
  })

  it('rejects a tampered message', () => {
    const tamperedMsg = utf8(v.message + '!')
    expect(ed25519.verify(signature, tamperedMsg, publicKey)).toBe(false)
  })
})

// ── ECDH P-256 ───────────────────────────────────────────────────────────────

describe('ECDH P-256 — plain-app vectors', () => {
  const v = vectors.ecdh
  const privateKeyA = b64ToBytes(v.privateKeyA)
  const publicKeyA = b64ToBytes(v.publicKeyA)
  const privateKeyB = b64ToBytes(v.privateKeyB)
  const publicKeyB = b64ToBytes(v.publicKeyB)
  const expectedSharedKey = b64ToBytes(v.sharedKey)

  it('private keys are 32 bytes', () => {
    expect(privateKeyA).toHaveLength(32)
    expect(privateKeyB).toHaveLength(32)
  })

  it('public keys are 65 bytes (X9.63 uncompressed: 0x04 || X || Y)', () => {
    expect(publicKeyA).toHaveLength(65)
    expect(publicKeyA[0]).toBe(0x04)
    expect(publicKeyB).toHaveLength(65)
    expect(publicKeyB[0]).toBe(0x04)
  })

  it('ECDH(A_priv, B_pub) == sharedKey', () => {
    const sharedPoint = p256.getSharedSecret(privateKeyA, publicKeyB)
    // getSharedSecret returns uncompressed point (04 || X || Y); the raw
    // ECDH shared secret is the X coordinate (bytes 1..33).
    const sharedX = sharedPoint.subarray(1, 33)
    const derivedKey = sha256(sharedX)
    expect(Array.from(derivedKey)).toEqual(Array.from(expectedSharedKey))
  })

  it('ECDH(B_priv, A_pub) == sharedKey (symmetry)', () => {
    const sharedPoint = p256.getSharedSecret(privateKeyB, publicKeyA)
    const sharedX = sharedPoint.subarray(1, 33)
    const derivedKey = sha256(sharedX)
    expect(Array.from(derivedKey)).toEqual(Array.from(expectedSharedKey))
  })

  it('shared key base64 matches the vector', () => {
    const sharedPoint = p256.getSharedSecret(privateKeyA, publicKeyB)
    const sharedX = sharedPoint.subarray(1, 33)
    const derivedKey = sha256(sharedX)
    expect(bytesToB64(derivedKey)).toBe(v.sharedKey)
  })
})

// ── base64 ───────────────────────────────────────────────────────────────────

describe('base64 — plain-app vectors', () => {
  const v = vectors.base64
  const input = Uint8Array.from(v.input)

  it('encodes known bytes to the expected base64 string', () => {
    expect(bytesToB64(input)).toBe(v.output)
  })

  it('decodes the base64 string back to the original bytes', () => {
    expect(Array.from(b64ToBytes(v.output))).toEqual(v.input)
  })

  it('roundtrips arbitrary bytes', () => {
    const arbitrary = Uint8Array.from([0, 1, 2, 254, 255, 128, 64, 32])
    const encoded = bytesToB64(arbitrary)
    const decoded = b64ToBytes(encoded)
    expect(Array.from(decoded)).toEqual(Array.from(arbitrary))
  })
})

// ── hex ──────────────────────────────────────────────────────────────────────

describe('hex — plain-app vectors', () => {
  const v = vectors.hex
  const input = Uint8Array.from(v.input)

  it('encodes known bytes to the expected lowercase hex string', () => {
    expect(bytesToHex(input)).toBe(v.output)
  })

  it('produces lowercase output', () => {
    expect(v.output).toBe(v.output.toLowerCase())
  })

  it('handles the full byte range', () => {
    const allBytes = Uint8Array.from({ length: 256 }, (_, i) => i)
    const hex = bytesToHex(allBytes)
    expect(hex).toHaveLength(512)
    expect(hex).toMatch(/^[0-9a-f]+$/)
    // First and last bytes.
    expect(hex.substring(0, 2)).toBe('00')
    expect(hex.substring(510, 512)).toBe('ff')
  })
})
