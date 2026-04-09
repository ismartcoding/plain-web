/** Convert an ArrayBuffer to a Uint8Array key/data representation. */
export function arrayBuffertoBits(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer)
}

/** Convert a Uint8Array back to an ArrayBuffer. */
export function arrayBufferFromBits(arr: Uint8Array): ArrayBuffer {
  // Ensure we return a plain ArrayBuffer (not SharedArrayBuffer)
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer
}

export function parseWebSocketData(buffer: ArrayBuffer): { type: number; data: Uint8Array } {
  if (buffer.byteLength < 4) return { type: 0, data: new Uint8Array(0) }
  const view = new DataView(buffer)
  const type = view.getInt32(0)
  const data = new Uint8Array(buffer, 4)
  return { type, data }
}
