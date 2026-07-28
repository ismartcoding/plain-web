import { describe, it, expect } from 'vitest'
import { isKeyframeNalu, extractAvc1CodecString, ScreenMirrorVideoPipeline } from '@/lib/mirror-codec-video'

const SC = [0x00, 0x00, 0x00, 0x01]

function annexB(nals: number[][]): Uint8Array {
  const parts: number[] = []
  for (const nal of nals) parts.push(...SC, ...nal)
  return new Uint8Array(parts)
}

function spsOf(profile: number, compat: number, level: number, ...extra: number[]): number[] {
  // SPS NAL header is 0x67 (NAL type 7). Bytes 1-3 carry profile/compat/level.
  return [0x67, profile, compat, level, ...extra]
}

function ppsOf(...extra: number[]): number[] {
  return [0x68, ...extra]
}

describe('isKeyframeNalu', () => {
  it('returns true for a single IDR slice (NAL type 5)', () => {
    const buf = annexB([[0x65, 0x88, 0x80, 0x40, 0x00]])
    expect(isKeyframeNalu(buf)).toBe(true)
  })

  it('returns true for an IDR even when AUD precedes it', () => {
    const buf = annexB([[0x09, 0xf0], [0x65, 0x88, 0x80, 0x40, 0x00]])
    expect(isKeyframeNalu(buf)).toBe(true)
  })

  it('returns false for a non-IDR (P) slice (NAL type 1)', () => {
    const buf = annexB([[0x41, 0x9a, 0x24, 0x6c, 0x41, 0xff]])
    expect(isKeyframeNalu(buf)).toBe(false)
  })

  it('returns false for SPS/PPS-only access units', () => {
    const buf = annexB([
      [0x67, 0x42, 0xc0, 0x1e, 0xd9, 0x00, 0xa0, 0x47, 0xfe, 0xc8],
      [0x68, 0xce, 0x38, 0x80],
    ])
    expect(isKeyframeNalu(buf)).toBe(false)
  })

  it('returns true for IDR when SEI precedes it', () => {
    const buf = annexB([[0x06, 0x05, 0x00, 0x80], [0x65, 0x88, 0x80, 0x40]])
    expect(isKeyframeNalu(buf)).toBe(true)
  })

  it('returns false for an empty buffer', () => {
    expect(isKeyframeNalu(new Uint8Array(0))).toBe(false)
  })

  it('returns false for a buffer with no start code', () => {
    const buf = new Uint8Array([0x65, 0x88, 0x80, 0x40])
    expect(isKeyframeNalu(buf)).toBe(false)
  })

  it('accepts the 3-byte start code variant', () => {
    const u = new Uint8Array([0x00, 0x00, 0x01, 0x65, 0x88, 0x80, 0x40])
    expect(isKeyframeNalu(u)).toBe(true)
  })

  it('returns true for IDR when nal_ref_idc is 0 (NAL header 0x05)', () => {
    const buf = annexB([[0x05, 0x88, 0x80, 0x40]])
    expect(isKeyframeNalu(buf)).toBe(true)
  })

  it('returns true for an AVCC IDR chunk (4-byte length prefix + NAL type 5)', () => {
    // AVCC: [len_hi, len_mid, len_lo, len_hi_byte, ...NAL...]
    // For an IDR NAL 0x65 0x88 0x80 0x40 (4 bytes), length = 4
    const u = new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x65, 0x88, 0x80, 0x40])
    expect(isKeyframeNalu(u)).toBe(true)
  })

  it('returns false for an AVCC P-frame chunk (NAL type 1)', () => {
    // P-slice NAL header 0x41 (ref_idc=1, type=1)
    const u = new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x41, 0x9a, 0x24, 0x6c])
    expect(isKeyframeNalu(u)).toBe(false)
  })

  it('returns false for AVCC chunks with a garbage prefix that looks length-like', () => {
    // A 4-byte sequence that is NOT a valid AVCC length (e.g. 0xff 0xff 0xff 0xff
    // would read as length 4294967295 — larger than the buffer). Must NOT be
    // misread as an IDR NAL header at offset 4.
    const u = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x65, 0x88, 0x80, 0x40])
    expect(isKeyframeNalu(u)).toBe(false)
  })

  it('returns false for AVCC with length=0', () => {
    const u = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x65, 0x88, 0x80])
    expect(isKeyframeNalu(u)).toBe(false)
  })
})

describe('extractAvc1CodecString', () => {
  it('extracts the codec string from the SPS', () => {
    const config = new Uint8Array(annexB([
      spsOf(0x42, 0xc0, 0x1e),
      ppsOf(),
    ]))
    expect(extractAvc1CodecString(config)).toBe('avc1.42c01e')
  })

  it('returns null when SPS is missing', () => {
    const config = new Uint8Array(annexB([ppsOf()]))
    expect(extractAvc1CodecString(config)).toBeNull()
  })
})
