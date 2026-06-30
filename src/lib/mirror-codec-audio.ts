/**
 * WebCodecs wrappers for screen mirroring — audio.
 * AudioDecoder: Opus packets → AudioData → AudioBufferSourceNode → AudioContext
 *
 * Wire format:
 *   - Audio packets are raw Opus packets (no framing) from
 *     MediaCodecAudioEncoder's drainLoop.
 */

export class ScreenMirrorAudioPipeline {
  private decoder: AudioDecoder | null = null
  private audio: HTMLAudioElement | null = null
  private audioCtx: AudioContext | null = null
  private gain: GainNode | null = null
  private nextStartTime = 0
  private ready = false
  private enabled = false
  private sampleRate = 48_000
  private channels = 2

  attach(audio: HTMLAudioElement) {
    this.audio = audio
  }

  prepare(sampleRate: number = 48_000, channels: number = 2) {
    this.sampleRate = sampleRate
    this.channels = channels
    this.decoder = this.buildDecoder()
    this.ready = true
  }

  private buildDecoder() {
    const d = new AudioDecoder({
      output: (data) => this.renderAudio(data),
      error: (e) => {
        console.error('[MirrorCodec] audio decoder error, recreating', e)
        this.recreateDecoder()
      },
    })
    d.configure({
      codec: 'opus',
      sampleRate: this.sampleRate,
      numberOfChannels: this.channels,
    } as AudioDecoderConfig)
    return d
  }

  private recreateDecoder() {
    if (this.decoder) {
      try { this.decoder.close() } catch (_) { /* ignore */ }
    }
    try {
      this.decoder = this.buildDecoder()
    } catch (e) {
      console.error('[MirrorCodec] decoder recreate failed', e)
    }
  }

  async enable() {
    if (this.enabled) return
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext({ latencyHint: 'interactive' })
      this.gain = this.audioCtx.createGain()
      this.gain.connect(this.audioCtx.destination)
      this.nextStartTime = 0
      this.gain.gain.value = this.audio?.muted ? 0 : 1
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume()
    }
    this.enabled = true
  }

  isEnabled() {
    return this.enabled
  }

  setMuted(muted: boolean) {
    if (this.gain) this.gain.gain.value = muted ? 0 : 1
    if (this.audio) this.audio.muted = muted
  }

  decode(packet: ArrayBuffer, timestamp: number) {
    if (!this.ready || !this.decoder || !this.enabled) return
    try {
      this.decoder.decode(new EncodedAudioChunk({
        type: 'key',
        timestamp,
        data: packet,
      }))
    } catch (e) {
      console.error('[MirrorCodec] audio decode failed, recreating decoder', e)
      this.recreateDecoder()
      try {
        this.decoder!.decode(new EncodedAudioChunk({
          type: 'key',
          timestamp,
          data: packet,
        }))
      } catch (e2) {
        console.error('[MirrorCodec] decode retry failed', e2)
      }
    }
  }

  close() {
    try { this.decoder?.close() } catch (_) { /* ignore */ }
    this.decoder = null
    this.ready = false
    this.enabled = false
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => undefined)
      this.audioCtx = null
    }
    this.gain = null
    this.nextStartTime = 0
  }

  private renderAudio(data: AudioData) {
    if (!this.audioCtx || !this.gain) {
      data.close()
      return
    }
    const channels = data.numberOfChannels
    const frames = data.numberOfFrames
    const sampleFormat = data.format
    const isPlanar = sampleFormat?.endsWith('-planar') ?? false
    const buf = this.audioCtx.createBuffer(channels, frames, data.sampleRate)
    if (isPlanar) {
      // f32-planar / s16-planar: each channel is its own plane (planeIndex = channel)
      const bytesPerSample = sampleFormat!.startsWith('s32') ? 4 : sampleFormat!.startsWith('s16') ? 2 : 4
      const isInt = sampleFormat!.startsWith('s')
      for (let ch = 0; ch < channels; ch++) {
        const byteLen = data.allocationSize({ planeIndex: ch, frameCount: frames })
        const out = new Float32Array(frames)
        if (isInt) {
          const bytes = new Uint8Array(byteLen)
          const view = new DataView(bytes.buffer)
          data.copyTo(bytes, { planeIndex: ch, frameOffset: 0, frameCount: frames })
          for (let i = 0; i < frames; i++) {
            if (bytesPerSample === 2) out[i] = view.getInt16(i * 2, true) / 32768
            else if (bytesPerSample === 4) out[i] = view.getInt32(i * 4, true) / 2147483648
            else out[i] = view.getInt8(i) / 128
          }
        } else {
          const src = new Float32Array(byteLen / 4)
          data.copyTo(src, { planeIndex: ch, frameOffset: 0, frameCount: frames })
          out.set(src)
        }
        buf.copyToChannel(out, ch)
      }
    } else {
      // interleaved (s16 / s32 / f32): single plane, deinterleave manually
      const bytesPerSample = sampleFormat!.startsWith('s32') ? 4 : sampleFormat!.startsWith('s16') ? 2 : 4
      const bytesPerFrame = bytesPerSample * channels
      const byteLen = data.allocationSize({ planeIndex: 0, frameCount: frames })
      const bytes = new Uint8Array(byteLen)
      const view = new DataView(bytes.buffer)
      data.copyTo(bytes, { planeIndex: 0, frameOffset: 0, frameCount: frames })
      const isInt = sampleFormat!.startsWith('s')
      for (let ch = 0; ch < channels; ch++) {
        const out = new Float32Array(frames)
        for (let i = 0; i < frames; i++) {
          const off = i * bytesPerFrame + ch * bytesPerSample
          if (isInt) {
            if (bytesPerSample === 2) out[i] = view.getInt16(off, true) / 32768
            else if (bytesPerSample === 4) out[i] = view.getInt32(off, true) / 2147483648
            else out[i] = view.getInt8(off) / 128
          } else {
            out[i] = view.getFloat32(off, true)
          }
        }
        buf.copyToChannel(out, ch)
      }
    }
    const src = this.audioCtx.createBufferSource()
    src.buffer = buf
    // Route through a persistent GainNode so a future mute toggle only has to
    // flip `gain.gain.value` and doesn't need to rewire the audio graph.
    src.connect(this.gain)
    const now = this.audioCtx.currentTime
    // Schedule back-to-back: never start in the past (would be dropped) and
    // never start after the previous chunk's tail (would leave a gap).
    const startAt = Math.max(now + 0.005, this.nextStartTime)
    src.start(startAt)
    this.nextStartTime = startAt + buf.duration
    data.close()
  }
}
