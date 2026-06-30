/**
 * WebCodecs wrappers for screen mirroring — video.
 * VideoDecoder: H.264 NAL units → VideoFrame → canvas drawImage
 *
 * Wire format:
 *   - Video config blob (SPS+PPS) is Annex-B (each NAL preceded by
 *     `00 00 00 01`). The pipeline then prepends this to the first IDR
 *     chunk before handing it to VideoDecoder — that is the canonical
 *     in-band parameter-set delivery for Annex-B mode (the W3C AVC
 *     codec registration does not document a reliable description
 *     path for Annex-B in current Chromium, hence we seed in-band).
 *   - Video chunks are Annex-B (start-code delimited) single-NAL frames.
 *     The server's MediaCodecVideoEncoder.drainLoop calls avccToAnnexB
 *     for each output buffer before forwarding; if the encoder already
 *     emits Annex-B (the ExynosC2 path does), avccToAnnexB passes the
 *     bytes through unchanged.
 */

export class ScreenMirrorVideoPipeline {
  private decoder: VideoDecoder | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private lastConfigKey = ''
  private lastConfig: ArrayBuffer | null = null
  private onError: ((e: unknown) => void) | null = null

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })
  }

  setOnError(cb: (e: unknown) => void) {
    this.onError = cb
  }

  configure(config: ArrayBuffer) {
    const u = new Uint8Array(config)
    const codec = extractAvc1CodecStringForTest(u)
    if (!codec) {
      console.error('[MirrorCodec] config is not a valid Annex-B H.264 stream (no SPS NAL found)')
      return
    }
    const key = Array.from(u.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('')
    if (key === this.lastConfigKey && this.decoder && this.decoder.state === 'configured') {
      return
    }
    if (this.decoder) {
      try { this.decoder.close() } catch (_) { /* ignore */ }
      this.decoder = null
    }
    this.lastConfigKey = key
    this.lastConfig = config
    console.log(`[MirrorCodec] codec=${codec}, config=${config.byteLength}B`)
    this.decoder = new VideoDecoder({
      output: (frame) => this.renderFrame(frame),
      error: (e) => {
        console.error('[MirrorCodec] decoder error', e)
        this.onError?.(e)
      },
    })
    // Wire contract: Annex-B start-code delimited chunks. SPS/PPS are NOT
    // passed in `description` — instead, the pipeline prepends them to the
    // first IDR chunk via `ensureSpsPpsPrepended` (see decode()). This is
    // the canonical in-band parameter set delivery for Annex-B over
    // WebCodecs and the pattern used by mainstream H.264 streaming libs
    // (mp4-muxer, h264-live-player). Passing a separate AVCDecoderConfigurationRecord
    // in `description` alongside `avc.format: 'annexb'` is technically
    // allowed by the spec but does not decode in current Chromium.
    this.decoder.configure({
      codec,
      avc: { format: 'annexb' },
      optimizeForLatency: true,
      hardwareAcceleration: 'prefer-hardware',
    } as VideoDecoderConfig)
    console.log(`[MirrorCodec] configured, state=${this.decoder.state}`)
  }

  decode(chunk: ArrayBuffer, isKeyFrame: boolean, timestamp: number) {
    if (!this.decoder) {
      console.warn('[MirrorCodec] decode dropped: no decoder')
      return
    }
    if (this.decoder.state !== 'configured') {
      console.warn(`[MirrorCodec] decode dropped: state=${this.decoder.state}`)
      return
    }
    let data: ArrayBuffer = chunk
    // First IDR after configure: WebCodecs Annex-B mode needs the SPS and PPS
    // NALs prepended in-band to seed the decoder. The cached `lastConfig`
    // is the original Annex-B SPS+PPS broadcast from the server
    // (each NAL preceded by 00 00 00 01). Concatenating it ahead of the IDR
    // NAL (which already has its own start code from MediaCodec.avccToAnnexB)
    // produces a single access unit the decoder can ingest end-to-end.
    if (isKeyFrame && this.lastConfig) {
      const cfg = new Uint8Array(this.lastConfig)
      const merged = new Uint8Array(cfg.byteLength + chunk.byteLength)
      merged.set(cfg, 0)
      merged.set(new Uint8Array(chunk), cfg.byteLength)
      data = merged.buffer
      this.lastConfig = null
    }
    try {
      this.decoder.decode(new EncodedVideoChunk({
        type: isKeyFrame ? 'key' : 'delta',
        timestamp,
        data,
      }))
    } catch (e) {
      console.error('[MirrorCodec] decode failed', e)
      this.onError?.(e)
    }
  }

  close() {
    try { this.decoder?.close() } catch (_) { /* ignore */ }
    this.decoder = null
    if (this.ctx && this.canvas) {
      this.ctx.fillStyle = '#000'
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  private renderFrame(frame: VideoFrame) {
    if (!this.canvas || !this.ctx) {
      frame.close()
      return
    }
    // The encoder's output dimensions match the phone's current orientation
    // (Android rebuilds the encoder on rotation, so each VideoFrame arrives
    // already in the correct orientation for the current display). We just
    // size the canvas to the frame and draw it as-is.
    if (this.canvas.width !== frame.displayWidth || this.canvas.height !== frame.displayHeight) {
      this.canvas.width = frame.displayWidth
      this.canvas.height = frame.displayHeight
    }
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height)
    frame.close()
  }
}

/**
 * Locate every NAL unit in an Annex-B H.264 buffer. Returns the slice
 * `[start, end)` of the NAL bytes (excluding the start code) and the NAL
 * type (lower 5 bits of the header byte). Used by the keyframe detector,
 * codec-string extractor, and avcC builder so all three walk NALs the same
 * way.
 */
function findAnnexBNals(u: Uint8Array): Array<{ start: number, end: number, type: number }> {
  const out: Array<{ start: number, end: number, type: number }> = []
  let off = 0
  while (off < u.length) {
    const nalStart = skipAnnexBStartCode(u, off)
    if (nalStart < 0 || nalStart >= u.length) break
    // Find next start code. Accept either 3- or 4-byte form mid-stream.
    let next = nalStart + 1
    while (next + 3 <= u.length) {
      if (u[next] === 0 && u[next + 1] === 0
        && (u[next + 2] === 1 || (u[next + 2] === 0 && next + 3 < u.length && u[next + 3] === 1))) {
        break
      }
      next++
    }
    // If the loop fell through without a `break`, fewer than 3 bytes remain
    // after `next` and the NAL runs to the end of the buffer.
    if (next + 3 > u.length) next = u.length
    out.push({ start: nalStart, end: next, type: u[nalStart] & 0x1f })
    off = next
  }
  return out
}

/**
 * Walk past an Annex-B start code (3- or 4-byte variant) and return the index
 * of the first NAL byte. Returns -1 if no start code is found.
 */
function skipAnnexBStartCode(u: Uint8Array, off: number): number {
  if (off + 4 <= u.length
    && u[off] === 0 && u[off + 1] === 0 && u[off + 2] === 0 && u[off + 3] === 1) {
    return off + 4
  }
  if (off + 3 <= u.length
    && u[off] === 0 && u[off + 1] === 0 && u[off + 2] === 1) {
    return off + 3
  }
  return -1
}

/**
 * Detect whether an H.264 chunk is an IDR (keyframe). Two framing modes
 * arrive at this function:
 *
 *   - Annex-B (start-code delimited): legacy path and unit tests. Walks
 *     every NAL — SEI/AUD may precede the slice header in the same chunk,
 *     so a single NAL scan would miss an IDR that lives behind them.
 *   - AVCC (4-byte big-endian length + NAL): what the MediaCodec encoder
 *     actually emits. Each chunk is a single NAL, so just check the
 *     NAL header at offset 4.
 *
 * The two formats are unambiguous on the wire: Annex-B always starts with
 * `00 00 00 01` (or the 3-byte variant), and a real AVCC length prefix is
 * > 1 for any meaningful NAL — so we use the start-code sniff to dispatch.
 *
 * NAL type lives in the lower 5 bits of the NAL header byte; type 5 = IDR.
 */
export function isKeyframeNalu(nalu: ArrayBuffer): boolean {
  const u = new Uint8Array(nalu)
  if (u.length < 5) return false
  if (u[0] === 0 && u[1] === 0) {
    const is4ByteSC = u[2] === 0 && u[3] === 1
    const is3ByteSC = u[2] === 1
    if (is4ByteSC || is3ByteSC) {
      return findAnnexBNals(u).some(n => n.type === 5)
    }
  }
  // AVCC: 4-byte big-endian length, then NAL header. Reject pathological
  // lengths so we don't misread an arbitrary payload as AVCC.
  const len = ((u[0] << 24) >>> 0) | (u[1] << 16) | (u[2] << 8) | u[3]
  if (len <= 1 || len > u.length - 4) return false
  return (u[4] & 0x1f) === 5
}

/**
 * Extract `avc1.PPCCLL` from the first SPS NAL in an Annex-B config blob.
 * Returns null if no SPS (NAL type 7) can be located. Exported under
 * `extractAvc1CodecStringForTest` so the test suite can verify the round-trip
 * through `buildAvcCFromAnnexB`.
 */
export function extractAvc1CodecStringForTest(u: Uint8Array): string | null {
  for (const n of findAnnexBNals(u)) {
    if (n.type === 7 && n.end - n.start >= 4) {
      const profile = u[n.start + 1].toString(16).padStart(2, '0')
      const compat = u[n.start + 2].toString(16).padStart(2, '0')
      const level = u[n.start + 3].toString(16).padStart(2, '0')
      return `avc1.${profile}${compat}${level}`
    }
  }
  return null
}

/**
 * Wrap an Annex-B SPS+PPS blob into the AVCDecoderConfigurationRecord bytes
 * WebCodecs wants in `VideoDecoderConfig.description`. Note: **the record
 * itself, NOT the ISO BMFF avcC box** — WebCodecs parses from byte 0 as
 * configurationVersion (must be 1), so the 4-byte size + 'avcC' magic would
 * be misread as `configurationVersion=0` and rejected.
 *
 * Layout (ISO/IEC 14496-15 §5.2.4.1):
 *   1 byte   configurationVersion (1)
 *   1 byte   AVCProfileIndication (from SPS[1])
 *   1 byte   profile_compatibility (SPS[2])
 *   1 byte   AVCLevelIndication (SPS[3])
 *   1 byte   0xFF — reserved(6) | lengthSizeMinusOne(2)=3 (4-byte NAL lengths)
 *   1 byte   0xE1 — reserved(3) | numOfSequenceParameterSets(5)=1
 *   2 bytes  SPS length (big-endian)
 *   N bytes  SPS
 *   1 byte   numOfPictureParameterSets = 1
 *   2 bytes  PPS length (big-endian)
 *   N bytes  PPS
 */
export function buildAvcCFromAnnexB(config: Uint8Array): ArrayBuffer {
  const nals = findAnnexBNals(config)
  const sps = nals.find(n => n.type === 7)
  const pps = nals.find(n => n.type === 8)
  if (!sps) {
    throw new Error('config is missing SPS NAL')
  }
  if (!pps) {
    throw new Error('config is missing PPS NAL')
  }
  const spsBytes = config.subarray(sps.start, sps.end)
  const ppsBytes = config.subarray(pps.start, pps.end)
  const spsLen = spsBytes.length
  const ppsLen = ppsBytes.length
  const out = new Uint8Array(11 + spsLen + ppsLen)
  let o = 0
  out[o++] = 0x01 // configurationVersion
  out[o++] = spsBytes[1] // profile
  out[o++] = spsBytes[2] // compat
  out[o++] = spsBytes[3] // level
  out[o++] = 0xff // lengthSizeMinusOne(3) | reserved(0x3F)
  out[o++] = 0xe1 // numSps(1) | reserved(0x7)
  out[o++] = (spsLen >>> 8) & 0xff
  out[o++] = spsLen & 0xff
  out.set(spsBytes, o); o += spsLen
  out[o++] = 0x01 // numPps
  out[o++] = (ppsLen >>> 8) & 0xff
  out[o++] = ppsLen & 0xff
  out.set(ppsBytes, o)
  return out.buffer
}
