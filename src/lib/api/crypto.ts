import { sha512Hex } from './sha512'
import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from '@noble/ciphers/webcrypto'

export function sha512(input: string): string {
  return sha512Hex(input)
}

/** Take first 32 ASCII chars of hex hash as a 32-byte key */
export function hashToKey(hash: string): Uint8Array {
  const sub = hash.substring(0, 32)
  return new Uint8Array(sub.split('').map((c) => c.charCodeAt(0)))
}

export function chachaEncrypt(key: Uint8Array, plaintext: string): Uint8Array {
  const nonce = randomBytes(24)
  const key32 = new Uint8Array(32)
  key32.set(key.slice(0, 32))
  const plaintextBytes = new TextEncoder().encode(plaintext)
  const cipher = xchacha20poly1305(key32, nonce)
  const ciphertext = cipher.encrypt(plaintextBytes)
  const result = new Uint8Array(nonce.length + ciphertext.length)
  result.set(nonce, 0)
  result.set(ciphertext, nonce.length)
  return result
}

export function chachaDecrypt(key: Uint8Array, data: Uint8Array): string {
  const nonce = data.slice(0, 24)
  const ciphertext = data.slice(24)
  const key32 = new Uint8Array(32)
  key32.set(key.slice(0, 32))
  const cipher = xchacha20poly1305(key32, nonce)
  const plaintext = cipher.decrypt(ciphertext)
  return new TextDecoder().decode(plaintext)
}

export function arrayBufferToBitArray(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer)
}

export function bitArrayToUint8Array(arr: Uint8Array): Uint8Array {
  return arr
}

export function bitArrayToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
}

