import { describe, it, expect } from 'vitest'
import {
  parseVideoPacket,
  isVideoPacket,
  VIDEO_PACKET_MAGIC,
  VIDEO_PACKET_HEADER_SIZE,
  FLAG_KEY_FRAME,
  FLAG_AUDIO,
} from '@/lib/video-packet'

/**
 * Build a VideoPacket buffer matching the Android VideoPacket.encode() wire
 * format (14-byte big-endian header + payload). Used to verify the web parser
 * round-trips with the encoder.
 */
function buildPacket(
  frameId: number,
  timestamp: bigint,
  flags: number,
  data: number[],
): Uint8Array {
  const out = new Uint8Array(VIDEO_PACKET_HEADER_SIZE + data.length)
  out[0] = VIDEO_PACKET_MAGIC
  out[1] = flags
  out[2] = (frameId >>> 24) & 0xff
  out[3] = (frameId >>> 16) & 0xff
  out[4] = (frameId >>> 8) & 0xff
  out[5] = frameId & 0xff
  let ts = timestamp
  for (let i = 7; i >= 0; i--) {
    out[6 + i] = Number(ts & 0xffn)
    ts = ts >> 8n
  }
  for (let i = 0; i < data.length; i++) {
    out[VIDEO_PACKET_HEADER_SIZE + i] = data[i]
  }
  return out
}

describe('isVideoPacket', () => {
  it('returns true for a buffer starting with the magic byte', () => {
    const buf = buildPacket(1, 0n, 0, [0x65])
    expect(isVideoPacket(buf)).toBe(true)
  })

  it('returns false for a buffer with wrong magic', () => {
    const buf = new Uint8Array([0x00, 0x01, 0x02])
    expect(isVideoPacket(buf)).toBe(false)
  })

  it('returns false for a buffer shorter than the header', () => {
    const buf = new Uint8Array([VIDEO_PACKET_MAGIC, 0x00])
    expect(isVideoPacket(buf)).toBe(false)
  })
})

describe('parseVideoPacket', () => {
  it('parses a keyframe video packet', () => {
    const data = [0x65, 0x88, 0x80, 0x40]
    const buf = buildPacket(42, 1_000_000n, FLAG_KEY_FRAME, data)
    const pkt = parseVideoPacket(buf)
    expect(pkt).not.toBeNull()
    expect(pkt!.frameId).toBe(42)
    expect(pkt!.timestamp).toBe(1_000_000)
    expect(pkt!.isKeyFrame).toBe(true)
    expect(pkt!.isAudio).toBe(false)
    expect(Array.from(pkt!.data)).toEqual(data)
  })

  it('parses a P-frame video packet', () => {
    const data = [0x41, 0x9a, 0x24]
    const buf = buildPacket(7, 33_333n, 0, data)
    const pkt = parseVideoPacket(buf)
    expect(pkt).not.toBeNull()
    expect(pkt!.frameId).toBe(7)
    expect(pkt!.timestamp).toBe(33_333)
    expect(pkt!.isKeyFrame).toBe(false)
    expect(pkt!.isAudio).toBe(false)
  })

  it('parses an audio packet', () => {
    const data = [0x4f, 0x67, 0x67, 0x53]
    const buf = buildPacket(100, 500_000n, FLAG_AUDIO, data)
    const pkt = parseVideoPacket(buf)
    expect(pkt).not.toBeNull()
    expect(pkt!.frameId).toBe(100)
    expect(pkt!.isAudio).toBe(true)
    expect(pkt!.isKeyFrame).toBe(false)
    expect(Array.from(pkt!.data)).toEqual(data)
  })

  it('parses a packet with max uint32 frameId', () => {
    const buf = buildPacket(0xffffffff, 0n, 0, [0x00])
    const pkt = parseVideoPacket(buf)
    expect(pkt).not.toBeNull()
    expect(pkt!.frameId).toBe(4294967295)
  })

  it('parses a packet with a large 64-bit timestamp', () => {
    // 0x0000FFFFFFFFFFFF — exercises all 8 timestamp bytes
    const ts = (1n << 48n) - 1n
    const buf = buildPacket(1, ts, 0, [0x00])
    const pkt = parseVideoPacket(buf)
    expect(pkt).not.toBeNull()
    expect(pkt!.timestamp).toBe(Number(ts))
  })

  it('returns null for a buffer with wrong magic', () => {
    const buf = new Uint8Array([0x00, ...new Uint8Array(13)])
    expect(parseVideoPacket(buf)).toBeNull()
  })

  it('returns null for a buffer shorter than the header', () => {
    expect(parseVideoPacket(new Uint8Array(4))).toBeNull()
  })

  it('returns a zero-copy view (subarray) of the payload', () => {
    const data = [0x65, 0x88, 0x80, 0x40]
    const buf = buildPacket(1, 0n, FLAG_KEY_FRAME, data)
    const pkt = parseVideoPacket(buf)!
    // subarray shares the underlying buffer — same ArrayBuffer, offset by header size
    expect(pkt.data.byteOffset).toBe(buf.byteOffset + VIDEO_PACKET_HEADER_SIZE)
    expect(pkt.data.byteLength).toBe(data.length)
  })

  it('handles a combined keyframe + audio flag packet', () => {
    const buf = buildPacket(1, 0n, FLAG_KEY_FRAME | FLAG_AUDIO, [0x00])
    const pkt = parseVideoPacket(buf)!
    expect(pkt.isKeyFrame).toBe(true)
    expect(pkt.isAudio).toBe(true)
  })
})
