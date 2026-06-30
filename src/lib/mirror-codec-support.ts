export function isWebCodecsSupported(): boolean {
  return typeof window !== 'undefined'
    && 'VideoDecoder' in window
    && 'AudioDecoder' in window
    && 'EncodedVideoChunk' in window
}
