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

export class ScreenMirrorVideoPipeline {
  private decoder: VideoDecoder | null = null
  private renderer = new MirrorGLRenderer()
  private lastConfigKey = ''
  private lastConfig: Uint8Array | null = null
  private onError: ((e: unknown) => void) | null = null
  private onRequestKeyFrame: (() => void) | null = null
  private onFirstFrameRendered: (() => void) | null = null

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

  configure(config: Uint8Array) {
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
    console.log(`[MirrorCodec] codec=${codec}, config=${config.byteLength}B`)
    this.decoder = new VideoDecoder({
      output: (frame) => this.renderFrame(frame),
      error: (e) => {
        console.error('[MirrorCodec] decoder error', e)
        this.waitingForIdr = true
        this.onRequestKeyFrame?.()
        this.onError?.(e)
      },
    })
    this.decoder.configure({
      codec,
      avc: { format: 'annexb' },
      optimizeForLatency: true,
      hardwareAcceleration: 'prefer-hardware',
    } as VideoDecoderConfig)
    console.log(`[MirrorCodec] configured, state=${this.decoder.state}`)
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
    // First IDR after configure: prepend SPS+PPS in-band to seed the decoder.
    if (packet.isKeyFrame && this.lastConfig) {
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