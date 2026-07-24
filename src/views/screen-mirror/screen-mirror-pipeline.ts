import { ref, type Ref, onScopeDispose } from 'vue'
import { ScreenMirrorVideoPipeline, isKeyframeNalu } from '@/lib/mirror-codec-video'
import { ScreenMirrorAudioPipeline } from '@/lib/mirror-codec-audio'
import { isWebCodecsSupported } from '@/lib/mirror-codec-support'
import { gqlFetch } from '@/lib/api/gql-client'
import { screenMirrorVideoCodecGQL } from '@/lib/api/query'
import { base64ToArrayBuffer } from '@/lib/strutil'

export interface ScreenMirrorVideoCodec {
  annexB: string
  keyFrame?: string
}

/**
 * Wall-clock monotonic pts (microseconds) shared by audio + video frames.
 * The base anchor is captured lazily on the first call, so the first frame
 * gets pts=0 and subsequent frames are time-since-first in microseconds.
 * Video at 30fps and audio at 48kHz/20ms therefore land on the same clock
 * and stay in sync without per-stream counters.
 */
export function makePtsClock() {
  let baseUs = 0
  return {
    next(): number {
      const nowUs = performance.now() * 1000
      if (baseUs === 0) baseUs = nowUs
      return nowUs - baseUs
    },
    reset() {
      baseUs = 0
    },
  }
}

/**
 * Binary mirror pipeline: CONFIG (Annex-B SPS+PPS) pulled via GraphQL
 * `screenMirrorVideoCodec`; video NAL units decoded by WebCodecs VideoDecoder
 * and drawn to canvas; audio Opus packets decoded into <audio>.
 */
export function useScreenMirrorPipeline(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  audioRef: Ref<HTMLAudioElement | undefined>,
  onFirstFrame: () => void,
  onDisconnected: () => void,
) {
  const video = new ScreenMirrorVideoPipeline()
  const audio = new ScreenMirrorAudioPipeline()
  const supported = ref(isWebCodecsSupported())
  const paused = ref(false)
  let connected = false
  // Wall-clock anchor (microseconds). Each frame's pts is `now - base`, so
  // video and audio share one clock and need no per-stream counter.
  const pts = makePtsClock()
  // Cached codec config so the video decoder can be re-created on error
  // without a round-trip back to GraphQL. The encoder emits an IDR every
  // ~1s, so once we mark the decoder broken we drop P-frames until the
  // next IDR arrives and re-configure with the same SPS/PPS.
  let cachedConfig: ArrayBuffer | null = null
  let decoderNeedsReset = false

  onScopeDispose(() => {
    video.close()
    audio.close()
  })

  function b64ToBytes(b64: string): ArrayBuffer {
    const u8 = base64ToArrayBuffer(b64)
    return u8.buffer
  }

  async function connect() {
    cleanup()
    if (!isWebCodecsSupported()) {
      console.error('[MirrorPipeline] WebCodecs not supported')
      onDisconnected()
      return
    }
    const canvas = canvasRef.value
    const audioEl = audioRef.value
    if (!canvas) {
      console.error('[MirrorPipeline] canvas not ready')
      onDisconnected()
      return
    }
    video.attach(canvas)
    if (audioEl) audio.attach(audioEl)
    // Pull the codec config proactively; if the phone isn't mirroring, the
    // GraphQL field returns null and we abort.
    try {
      const r: any = await gqlFetch(screenMirrorVideoCodecGQL, {})
      const annexB = r?.data?.screenMirrorVideoCodec?.annexB ?? null
      if (!annexB) {
        console.warn('[MirrorPipeline] no screenMirrorVideoCodec from server')
        onDisconnected()
        return
      }
      const config = b64ToBytes(annexB)
      const kfB64: string | null = r?.data?.screenMirrorVideoCodec?.keyFrame ?? null
      const kf = kfB64 ? b64ToBytes(kfB64) : null
      console.log(`[MirrorPipeline] pulled config ${config.byteLength}B${kf ? ` + keyFrame ${kf.byteLength}B` : ''}`)
      cachedConfig = config
      decoderNeedsReset = false
      pts.reset()
      video.configure(config)
      video.setOnError(() => { decoderNeedsReset = true })
      if (kf) {
        video.decode(kf, true, pts.next())
        onFirstFrame()
      }
      audio.prepare()
      connected = true
    } catch (e) {
      console.error('[MirrorPipeline] failed to fetch screenMirrorVideoCodec', e)
      onDisconnected()
    }
  }

  function handleVideo(nalu: ArrayBuffer) {
    if (!connected || paused.value) return
    const isKey = isKeyframeNalu(nalu)
    // If the decoder errored, drop everything until the next IDR, then
    // re-configure with the cached config (creates a fresh VideoDecoder in
    // 'configured' state — see mirror-codec.configure).
    if (decoderNeedsReset && isKey && cachedConfig) {
      video.configure(cachedConfig)
      decoderNeedsReset = false
      console.log('[MirrorPipeline] decoder reset on IDR')
    } else if (decoderNeedsReset) {
      return
    }
    video.decode(nalu, isKey, pts.next())
    onFirstFrame()
  }

  function handleAudio(packet: ArrayBuffer) {
    if (!connected || paused.value) return
    audio.decode(packet, pts.next())
  }

  const togglePlay = () => { paused.value = !paused.value }

  const enableAudio = () => audio.enable()
  const isAudioEnabled = () => audio.isEnabled()
  const setAudioMuted = (m: boolean) => audio.setMuted(m)

  function handleConfig(codec: ScreenMirrorVideoCodec) {
    // Android embeds the new Annex-B SPS+PPS in the event payload, so we
    // can reconfigure the decoder directly without a GraphQL round-trip.
    // Canvas sizing is implicit in renderFrame (frame.displayWidth/Height),
    // so the web side doesn't need to know width/height/rotation.
    if (!supported.value || !connected) return
    if (!codec?.annexB) return
    const newConfig = b64ToBytes(codec.annexB)
    // Skip if the config is byte-identical to what the decoder already has —
    // configure() with the same bytes is a no-op but still resets the
    // decoder and costs an IDR to recover.
    const sameAsCached = cachedConfig
      && cachedConfig.byteLength === newConfig.byteLength
      && new Uint8Array(cachedConfig).every((b, i) => b === new Uint8Array(newConfig)[i])
    if (sameAsCached) return
    cachedConfig = newConfig
    decoderNeedsReset = false
    video.configure(newConfig)
    if (codec.keyFrame) {
      video.decode(b64ToBytes(codec.keyFrame), true, pts.next())
      onFirstFrame()
    }
    console.log(`[MirrorPipeline] reconfigured decoder on config event ${newConfig.byteLength}B${codec.keyFrame ? ` + keyFrame ${codec.keyFrame.length}B` : ''}`)
  }

  function cleanup() {
    video.close()
    audio.close()
    connected = false
  }

  return {
    supported,
    paused,
    connect,
    handleVideo,
    handleAudio,
    handleConfig,
    cleanup,
    togglePlay,
    enableAudio,
    isAudioEnabled,
    setAudioMuted,
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload()
  })
}
