/**
 * Binary video frame protocol — parser for the 14-byte header + payload
 * format emitted by Android's VideoPacket.encode().
 *
 * See shared/src/commonMain/.../VideoPacket.kt for the wire format spec.
 * Lives in lib/ so both the screen-mirror pipeline and unit tests can use it.
 */

export const VIDEO_PACKET_MAGIC = 0x56
export const VIDEO_PACKET_HEADER_SIZE = 14

export const FLAG_KEY_FRAME = 0x01
export const FLAG_CONFIG = 0x02
export const FLAG_AUDIO = 0x04

export interface VideoPacket {
  frameId: number
  timestamp: number
  isKeyFrame: boolean
  isConfig: boolean
  isAudio: boolean
  data: Uint8Array
}

export function isVideoPacket(buf: Uint8Array): boolean {
  return buf.length >= VIDEO_PACKET_HEADER_SIZE && buf[0] === VIDEO_PACKET_MAGIC
}

export function parseVideoPacket(buf: Uint8Array): VideoPacket | null {
  if (!isVideoPacket(buf)) return null
  const flags = buf[1]
  const frameId = ((buf[2] << 24) | (buf[3] << 16) | (buf[4] << 8) | buf[5]) >>> 0
  let timestamp = 0
  for (let i = 0; i < 8; i++) {
    timestamp = timestamp * 256 + buf[6 + i]
  }
  // subarray = zero-copy view into the original WebSocket buffer
  const data = buf.subarray(VIDEO_PACKET_HEADER_SIZE)
  return {
    frameId,
    timestamp,
    isKeyFrame: (flags & FLAG_KEY_FRAME) !== 0,
    isConfig: (flags & FLAG_CONFIG) !== 0,
    isAudio: (flags & FLAG_AUDIO) !== 0,
    data,
  }
}
