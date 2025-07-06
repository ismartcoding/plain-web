import { stringToArrayBuffer } from '../strutil'
import * as sjcl from 'sjcl'
import _ from './sha512'
import { arrayBufferFromBits, arrayBuffertoBits } from './sjcl-arraybuffer'
import { chacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from '@noble/ciphers/webcrypto'

export function sha512(input: string): string {
  const hashBits = sjcl.hash.sha512.hash(input)
  return sjcl.codec.hex.fromBits(hashBits)
}

export function hashToKey(hash: string): sjcl.BitArray {
  return arrayBuffertoBits(stringToArrayBuffer(hash.substring(0, 32)).buffer)
}

// Convert sjcl.BitArray to Uint8Array (for ChaCha20 key)
function bitArrayToBytes(bitArray: sjcl.BitArray): Uint8Array {
  const arrayBuffer = arrayBufferFromBits(bitArray)
  return new Uint8Array(arrayBuffer)
}

// Convert Uint8Array to sjcl.BitArray
function bytesToBitArray(bytes: Uint8Array): sjcl.BitArray {
  // Create a new ArrayBuffer to avoid type errors
  const buffer = new ArrayBuffer(bytes.length)
  const view = new Uint8Array(buffer)
  view.set(bytes)
  return arrayBuffertoBits(buffer)
}

/**
 * ChaCha20-Poly1305 encryption function
 * 
 * This implementation follows RFC 8439 standard:
 * - Uses 96-bit (12 bytes) nonce
 * - Uses 256-bit (32 bytes) key
 * - Outputs: nonce(12) + ciphertext + auth_tag(16)
 * 
 * Security considerations:
 * - Never reuse the same nonce with the same key
 * - Consider using a counter-based nonce for better security
 * - Random nonces are acceptable but have birthday collision risk after ~2^48 messages
 */
export function chachaEncrypt(key: sjcl.BitArray, plaintext: string): sjcl.BitArray {
  // Generate 12 bytes random nonce (RFC 8439 standard)
  // Note: For production systems, consider using a counter-based nonce
  // to avoid the birthday paradox collision risk with random nonces
  const nonce = randomBytes(12)
  
  // Convert key to 32-byte Uint8Array
  const keyBytes = bitArrayToBytes(key)
  // Ensure key is 32 bytes
  const key32 = new Uint8Array(32)
  key32.set(keyBytes.slice(0, 32))
  
  // Convert plaintext to Uint8Array
  const plaintextBytes = new TextEncoder().encode(plaintext)
  
  // Use ChaCha20-Poly1305 encryption
  const cipher = chacha20poly1305(key32, nonce)
  const ciphertext = cipher.encrypt(plaintextBytes)
  
  // Combine nonce and ciphertext (standard format: nonce + ciphertext + tag)
  const result = new Uint8Array(nonce.length + ciphertext.length)
  result.set(nonce, 0)
  result.set(ciphertext, nonce.length)
  
  return bytesToBitArray(result)
}

/**
 * ChaCha20-Poly1305 decryption function
 * 
 * Expects input format: nonce(12) + ciphertext + auth_tag(16)
 * Returns decrypted plaintext or throws error on authentication failure
 */
export function chachaDecrypt(key: sjcl.BitArray, data: sjcl.BitArray): string {
  const dataBytes = bitArrayToBytes(data)
  
  // Minimum size check: nonce(12) + tag(16) = 28 bytes
  if (dataBytes.length < 28) {
    throw new Error('Invalid ciphertext: too short')
  }
  
  // Extract nonce (first 12 bytes)
  const nonce = dataBytes.slice(0, 12)
  // Extract ciphertext + tag (remaining bytes)
  const ciphertext = dataBytes.slice(12)
  
  // Convert key to 32-byte Uint8Array
  const keyBytes = bitArrayToBytes(key)
  const key32 = new Uint8Array(32)
  key32.set(keyBytes.slice(0, 32))
  
  try {
    // Use ChaCha20-Poly1305 decryption
    const cipher = chacha20poly1305(key32, nonce)
    const plaintext = cipher.decrypt(ciphertext)
    
    return new TextDecoder().decode(plaintext)
  } catch (error) {
    throw new Error('Decryption failed: authentication error or corrupted data')
  }
}

export function arrayBufferToBitArray(buffer: ArrayBuffer): sjcl.BitArray {
  const uint8Array = new Uint8Array(buffer)
  return arrayBuffertoBits(uint8Array.buffer)
}

export function bitArrayToUint8Array(bitArray: sjcl.BitArray): Uint8Array {
  const arrayBuffer = arrayBufferFromBits(bitArray)
  return new Uint8Array(arrayBuffer)
}

export function bitArrayToBase64(bitArray: sjcl.BitArray): string {
  return sjcl.codec.base64.fromBits(bitArray)
}

