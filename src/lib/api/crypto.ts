import { stringToArrayBuffer } from '../strutil'
import * as sjcl from 'sjcl'
import _ from './sha512'
import { arrayBufferFromBits, arrayBuffertoBits } from './sjcl-arraybuffer'

export function sha512(input: string): string {
  const hashBits = sjcl.hash.sha512.hash(input)
  return sjcl.codec.hex.fromBits(hashBits)
}

export function hashToKey(hash: string): sjcl.BitArray {
  return arrayBuffertoBits(stringToArrayBuffer(hash.substring(0, 32)).buffer)
}

export function aesEncrypt(key: sjcl.BitArray, plaintext: string): sjcl.BitArray {
  const nonce = sjcl.random.randomWords(3)

  const cipher = new sjcl.cipher.aes(key)
  const encrypted = sjcl.mode.gcm.encrypt(cipher, sjcl.codec.utf8String.toBits(plaintext), nonce)
  return sjcl.bitArray.concat(nonce, encrypted)
}

export function aesDecrypt(key: sjcl.BitArray, data: sjcl.BitArray): string {
  const nonce = sjcl.bitArray.bitSlice(data, 0, 96)
  const ciphertext = sjcl.bitArray.bitSlice(data, 96, sjcl.bitArray.bitLength(data))
  const cipher = new sjcl.cipher.aes(key)
  const decrypted = sjcl.mode.gcm.decrypt(cipher, ciphertext, nonce)

  return sjcl.codec.utf8String.fromBits(decrypted)
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
