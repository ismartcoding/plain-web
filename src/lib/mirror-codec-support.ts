/**
 * Granular WebCodecs capability checks.
 *
 * WebKit shipped the WebCodecs VIDEO interfaces (VideoDecoder /
 * EncodedVideoChunk) in Safari 16.4, but the AUDIO interfaces (AudioDecoder /
 * EncodedAudioChunk) only in Safari 26. A combined check would wrongly kill
 * video playback entirely on macOS 15 / iOS 18 (Safari 18.x WKWebView), where
 * video decoding works fine — so video and audio are probed independently and
 * a missing audio path must only degrade audio.
 */
export function isVideoDecodeSupported(): boolean {
  return typeof window !== 'undefined'
    && 'VideoDecoder' in window
    && 'EncodedVideoChunk' in window
}

export function isAudioDecodeSupported(): boolean {
  return typeof window !== 'undefined'
    && 'AudioDecoder' in window
    && 'EncodedAudioChunk' in window
}

/** Which interfaces are missing — for diagnostics when a pipeline aborts. */
export function webCodecsMissing(): string[] {
  if (typeof window === 'undefined') return ['window']
  return (['VideoDecoder', 'EncodedVideoChunk', 'AudioDecoder', 'EncodedAudioChunk'] as const)
    .filter(k => !(k in window))
}
