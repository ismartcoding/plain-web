import { ref, type Ref } from 'vue'
import { WebRTCClient, type SignalingMessage } from '@/lib/webrtc-client'
import { sendWebRTCSignaling } from '@/lib/webrtc-signaling'
import { getPhoneIp } from '@/lib/api/api'

/**
 * Manages a single WebRTC session for screen mirroring.
 * Linear lifecycle: connect() → signaling → stream → cleanup()
 */
export function useScreenMirrorWebRTC(
  videoRef: Ref<HTMLVideoElement | undefined>,
  onStreamReady: () => void,
  onDisconnected: () => void,
) {
  let client: WebRTCClient | null = null
  const pendingStream = ref<MediaStream | null>(null)
  const signalingQueue: SignalingMessage[] = []

  function attachStream(stream: MediaStream) {
    const video = videoRef.value
    if (video) {
      video.srcObject = stream
      video.play().catch(() => {})
    } else {
      pendingStream.value = stream
    }
  }

  function retryPlay() {
    const video = videoRef.value
    if (video && video.srcObject && video.paused) {
      video.play().catch(() => {})
    }
  }

  function connect() {
    cleanup()
    client = new WebRTCClient({
      sendSignaling: sendWebRTCSignaling,
      onStream: (stream) => {
        attachStream(stream)
        onStreamReady()
      },
      onConnectionStateChange: (s) => {
        if (s === 'connected') retryPlay()
        else if (s === 'failed' || s === 'disconnected' || s === 'closed') onDisconnected()
      },
      onError: () => onDisconnected(),
    })
    client.startSession(true, false, getPhoneIp())
    flushQueue()
  }

  function handleSignaling(message: SignalingMessage) {
    if (client) {
      client.handleSignalingMessage(message)
    } else {
      signalingQueue.push(message)
    }
  }

  function flushQueue() {
    while (signalingQueue.length > 0) {
      const msg = signalingQueue.shift()!
      client?.handleSignalingMessage(msg)
    }
  }

  function cleanup() {
    signalingQueue.length = 0
    pendingStream.value = null
    const video = videoRef.value
    if (video) {
      video.pause()
      video.srcObject = null
    }
    if (client) {
      client.cleanup()
      client = null
    }
  }

  return { pendingStream, connect, handleSignaling, cleanup, retryPlay }
}
