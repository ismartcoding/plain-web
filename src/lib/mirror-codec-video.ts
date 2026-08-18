/**
 * WebCodecs video pipeline for screen mirroring.
 *
 * Data flow:
 *   VideoPacket (from WebSocket)
 *     → loss detection (frameId gap → request IDR)
 *     → backpressure (decodeQueueSize > 5 → drop P-frame)
 *     → timestamp scheduler (drop stale frames)
 *     → WebCodecs VideoDecoder
 *     → VideoFrame
 *     → MirrorGLRenderer (WebGL2 desynchronized, GPU-direct texture upload)
 *
 * Wire format:
 *   - Video config blob (SPS+PPS) is Annex-B (each NAL preceded by
 *     `00 00 00 01`). The pipeline prepends this to the first IDR chunk
 *     before handing it to VideoDecoder — canonical in-band parameter-set
 *     delivery for Annex-B mode.
 *   - Video chunks are Annex-B (start-code delimited) single-NAL frames.
 *   - Each frame is wrapped in a VideoPacket (frameId/timestamp/flags/data).
 */

import { MirrorGLRenderer } from './mirror-gl-renderer'
import type { VideoPacket as VideoFramePacket } from './video-packet'

/**
 * WebKit (Safari / WKWebView — Tauri on macOS & iOS) only decodes H.264 in
 * AVC (avcC) framing: length-prefixed NALs plus an avcC `description`.
 * Chromium additionally accepts Annex-B start-code framing. The preferred
 * format is probed at runtime via VideoDecoder.isConfigSupported() and flips
 * on decoder error, so a WebKit build that lies about support still recovers
 * on the next IDR.
 */
type AvcFormat = 'annexb' | 'avcC'

function isWebKit(): boolean {
  return typeof navigator !== 'undefined'
    && /AppleWebKit/.test(navigator.userAgent)
    && !/Chrome|Chromium/.test(navigator.userAgent)
}

export class ScreenMirrorVideoPipeline {
  private decoder: VideoDecoder | null = null
  private renderer = new MirrorGLRenderer()
  private lastConfigKey = ''
  private lastConfig: Uint8Array | null = null
  private onError: ((e: unknown) => void) | null = null
  private onRequestKeyFrame: (() => void) | null = null
  private onFirstFrameRendered: (() => void) | null = null

  // Format selection: WebKit defaults to avcC, Chromium to annexb. Confirmed
  // (or corrected) once via isConfigSupported, and flipped on decoder error.
  private formatPref: AvcFormat = isWebKit() ? 'avcC' : 'annexb'
  private formatProbed = false
  private currentFormat: AvcFormat = 'annexb'

  // Loss detection + error recovery
  private lastFrameId = 0
  private waitingForIdr = false
  private firstFrameRendered = false

  // Timestamp scheduler — drop frames older than the last rendered frame
  private lastRenderedPts = 0

  attach(canvas: HTMLCanvasElement) {
    this.renderer.attach(canvas)
  }

  setOnError(cb: (e: unknown) => void) {
    this.onError = cb
  }

  setOnRequestKeyFrame(cb: () => void) {
    this.onRequestKeyFrame = cb
  }

  setOnFirstFrameRendered(cb: () => void) {
    this.onFirstFrameRendered = cb
  }

  /**
   * Mark the pipeline as waiting for an IDR. All P-frames will be dropped
   * until the next keyframe arrives. Used at startup to skip the stale
   * GraphQL keyframe (which may be a blank frame produced before
   * VirtualDisplay rendered real screen content) and wait for a fresh IDR
   * from the encoder.
   */
  requestIdr() {
    this.waitingForIdr = true
  }

  async configure(config: Uint8Array) {
    const codec = extractAvc1CodecString(config)
    if (!codec) {
      console.error('[MirrorCodec] config is not a valid Annex-B H.264 stream (no SPS NAL found)')
      return
    }
    const key = Array.from(config.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('')
    if (key === this.lastConfigKey && this.decoder && this.decoder.state === 'configured') {
      return
    }
    if (this.decoder) {
      try { this.decoder.close() } catch (_) { /* ignore */ }
      this.decoder = null
    }
    this.lastConfigKey = key
    this.lastConfig = config
    this.waitingForIdr = false
    this.firstFrameRendered = false

    const format = await this.ensureFormat(codec, config)
    this.currentFormat = format
    console.log(`[MirrorCodec] codec=${codec}, config=${config.byteLength}B, format=${format}`)
    this.decoder = new VideoDecoder({
      output: (frame) => this.renderFrame(frame),
      error: (e) => {
        console.error(`[MirrorCodec] decoder error (format=${this.currentFormat}), flipping format for next IDR`, e)
        this.flipFormat()
        this.waitingForIdr = true
        this.onRequestKeyFrame?.()
        this.onError?.(e)
      },
    })
    const cfg: VideoDecoderConfig = {
      codec,
      optimizeForLatency: true,
      hardwareAcceleration: 'prefer-hardware',
    }
    if (format === 'avcC') {
      // WebKit: SPS/PPS must travel in the avcC description, not in-band.
      cfg.avc = { format: 'avcC', description: buildAvcCDescription(config) }
    } else {
      cfg.avc = { format: 'annexb' }
    }
    try {
      this.decoder.configure(cfg)
    } catch (e) {
      // Some engines throw synchronously instead of firing the error callback.
      // Flip the format and let the IDR-reset path reconfigure.
      console.error('[MirrorCodec] configure() threw', e)
      this.flipFormat()
      this.onRequestKeyFrame?.()
      this.onError?.(e)
      return
    }
    console.log(`[MirrorCodec] configured, state=${this.decoder.state}`)
  }

  /**
   * Resolve the decoder's AVC framing format once per session. Prefers the
   * UA-based default; if the engine reports it as unsupported, checks the
   * other format. When isConfigSupported is missing or both claim support we
   * keep the default — the decoder-error flip covers engines that lie.
   */
  private async ensureFormat(codec: string, config: Uint8Array): Promise<AvcFormat> {
    if (this.formatProbed) return this.formatPref
    this.formatProbed = true
    if (typeof VideoDecoder.isConfigSupported !== 'function') return this.formatPref
    const probe = async (format: AvcFormat) => {
      try {
        const cfg: VideoDecoderConfig = { codec, optimizeForLatency: true }
        cfg.avc = format === 'avcC'
          ? { format: 'avcC', description: buildAvcCDescription(config) }
          : { format: 'annexb' }
        const r = await VideoDecoder.isConfigSupported(cfg)
        return r?.supported === true
      } catch (_) {
        return false
      }
    }
    const preferred = await probe(this.formatPref)
    if (preferred) return this.formatPref
    const other: AvcFormat = this.formatPref === 'annexb' ? 'avcC' : 'annexb'
    const otherOk = await probe(other)
    console.warn(`[MirrorCodec] format probe: ${this.formatPref}=${preferred}, ${other}=${otherOk}`)
    if (otherOk) this.formatPref = other
    return this.formatPref
  }

  private flipFormat() {
    this.formatPref = this.formatPref === 'annexb' ? 'avcC' : 'annexb'
    this.formatProbed = true
  }

  decode(packet: VideoFramePacket) {
    if (!this.decoder || this.decoder.state !== 'configured') return

    // Loss detection: frameId gap means frames were lost. If the current
    // frame is a P-frame, it can't decode correctly without the missing
    // reference — enter waitingForIdr and request a keyframe from the server.
    // The !waitingForIdr guard ensures we only request once per loss event;
    // without it, every stale P-frame arriving during recovery would re-trigger
    // the gap (lastFrameId stays frozen) and flood the server with requests.
    if (!this.waitingForIdr && this.lastFrameId > 0 && packet.frameId > this.lastFrameId + 1) {
      const gap = packet.frameId - this.lastFrameId - 1
      console.warn(`[MirrorCodec] frame loss: ${gap} (frameId ${this.lastFrameId + 1}-${packet.frameId - 1})`)
      if (!packet.isKeyFrame) {
        this.waitingForIdr = true
        this.onRequestKeyFrame?.()
        this.lastFrameId = packet.frameId
        return
      }
    }
    this.lastFrameId = packet.frameId

    // Error recovery: after a loss or decoder error, discard P-frames until
    // the next IDR arrives. This prevents mosaic/garbage from accumulating.
    if (this.waitingForIdr) {
      if (packet.isKeyFrame) {
        this.waitingForIdr = false
        console.log('[MirrorCodec] recovered on IDR')
      } else {
        return
      }
    }

    // Backpressure: drop stale P-frames when the decoder queue grows.
    // Threshold of 5 tolerates HW decoder startup latency without
    // unnecessary P-frame drops that cause visual stutter.
    if (this.decoder.decodeQueueSize > 5 && !packet.isKeyFrame) {
      return
    }

    // Timestamp scheduler: drop frames that are older than the last
    // rendered frame (out-of-order arrival). Real-time priority —
    // always render the newest frame, never wait for a stale one.
    if (packet.timestamp < this.lastRenderedPts && !packet.isKeyFrame) {
      return
    }

    let data: Uint8Array = packet.data
    if (this.currentFormat === 'avcC') {
      // WebKit: SPS/PPS already live in the avcC description, so don't prepend
      // them; just re-frame the Annex-B chunk as AVCC length-prefixed NALs.
      data = annexBToAvcc(packet.data)
    } else if (packet.isKeyFrame && this.lastConfig) {
      // Annex-B: prepend SPS+PPS in-band to seed the decoder.
      const cfg = new Uint8Array(this.lastConfig)
      const merged = new Uint8Array(cfg.byteLength + packet.data.byteLength)
      merged.set(cfg, 0)
      merged.set(packet.data, cfg.byteLength)
      data = merged
      this.lastConfig = null
    }

    try {
      this.decoder.decode(new EncodedVideoChunk({
        type: packet.isKeyFrame ? 'key' : 'delta',
        timestamp: packet.timestamp,
        data,
      }))
    } catch (e) {
      console.error('[MirrorCodec] decode failed', e)
      this.waitingForIdr = true
      this.onRequestKeyFrame?.()
      this.onError?.(e)
    }
  }

  close() {
    this.renderer.close()
    try { this.decoder?.close() } catch (_) { /* ignore */ }
    this.decoder = null
    this.lastFrameId = 0
    this.waitingForIdr = false
    this.firstFrameRendered = false
  }

  private renderFrame(frame: VideoFrame) {
    this.lastRenderedPts = frame.timestamp
    this.renderer.renderFrame(frame)
    if (!this.firstFrameRendered) {
      this.firstFrameRendered = true
      this.onFirstFrameRendered?.()
    }
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
export function isKeyframeNalu(nalu: Uint8Array): boolean {
  const u = nalu
  if (u.length < 5) return false
  // Annex-B: walk all NALs (SEI/AUD may precede the IDR slice).
  if (skipAnnexBStartCode(u, 0) >= 0) {
    return findAnnexBNals(u).some(n => n.type === 5)
  }
  // AVCC: 4-byte big-endian length, then NAL header. Reject pathological
  // lengths so we don't misread an arbitrary payload as AVCC.
  const len = ((u[0] << 24) >>> 0) | (u[1] << 16) | (u[2] << 8) | u[3]
  if (len <= 1 || len > u.length - 4) return false
  return (u[4] & 0x1f) === 5
}

/**
 * Extract `avc1.PPCCLL` from the first SPS NAL in an Annex-B config blob.
 * Returns null if no SPS (NAL type 7) can be located.
 */
export function extractAvc1CodecString(u: Uint8Array): string | null {
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
 * Build an avcC box (ISO/IEC 14496-15) from an Annex-B SPS+PPS config blob.
 * WebKit requires SPS/PPS to travel in VideoDecoderConfig.description, so the
 * Annex-B config is repacked into the avcC `description` structure.
 */
function buildAvcCDescription(config: Uint8Array): Uint8Array {
  const nals = findAnnexBNals(config)
  const sps = nals.filter(n => n.type === 7)
  const pps = nals.filter(n => n.type === 8)
  const first = sps[0]
  if (!first || first.end - first.start < 4) return config
  let size = 6 + 1 + 1
  for (const n of sps) size += 2 + (n.end - n.start)
  for (const n of pps) size += 2 + (n.end - n.start)
  const out = new Uint8Array(size)
  let off = 0
  out[off++] = 1 // configurationVersion
  out[off++] = config[first.start + 1] // AVCProfileIndication
  out[off++] = config[first.start + 2] // profile_compatibility
  out[off++] = config[first.start + 3] // AVCLevelIndication
  out[off++] = 0xff // 0xfc | (lengthSizeMinusOne=3) → 4-byte NAL lengths
  out[off++] = 0xe0 | sps.length
  for (const n of sps) {
    const len = n.end - n.start
    out[off++] = (len >> 8) & 0xff
    out[off++] = len & 0xff
    out.set(config.subarray(n.start, n.end), off)
    off += len
  }
  out[off++] = pps.length
  for (const n of pps) {
    const len = n.end - n.start
    out[off++] = (len >> 8) & 0xff
    out[off++] = len & 0xff
    out.set(config.subarray(n.start, n.end), off)
    off += len
  }
  return out
}

/**
 * Re-frame an Annex-B chunk (start-code delimited NALs) as AVCC (4-byte
 * big-endian length prefix + NAL). WebKit's VideoDecoder expects this when
 * configured with format 'avcC'. If the chunk has no start codes (already
 * AVCC), it is returned unchanged.
 */
function annexBToAvcc(data: Uint8Array): Uint8Array {
  const nals = findAnnexBNals(data)
  if (nals.length === 0) return data
  let total = 0
  for (const n of nals) total += 4 + (n.end - n.start)
  const out = new Uint8Array(total)
  let off = 0
  for (const n of nals) {
    const len = n.end - n.start
    out[off] = (len >>> 24) & 0xff
    out[off + 1] = (len >>> 16) & 0xff
    out[off + 2] = (len >>> 8) & 0xff
    out[off + 3] = len & 0xff
    out.set(data.subarray(n.start, n.end), off + 4)
    off += 4 + len
  }
  return out
}
