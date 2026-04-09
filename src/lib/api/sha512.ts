import { sha512 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

// Pure-JS SHA-512 via @noble/hashes (works on HTTP and HTTPS)
export function sha512Hex(input: string): string {
  return bytesToHex(sha512(new TextEncoder().encode(input)))
}
