import { ref, type Ref } from 'vue'
import toast from '@/components/toaster'
import { WebRTCClient, type SignalingMessage } from '@/lib/webrtc-client'
import { sendWebRTCSignaling } from '@/lib/webrtc-signaling'

export function useScreenMirrorWebRTC(
  videoRef: Ref<HTMLVideoElement | undefined>,
  mirroring: Ref<boolean>,
  failed: Ref<boolean>,
  seconds: Ref<number>,
  connecting: Ref<boolean>,
  clearCountInterval: () => void,
) {
  let webrtcClient: WebRTCClient | null = null
  const pendingStream = ref<MediaStream | null>(null)

  const initWebRTCClient = () => {
    if (webrtcClient) webrtcClient.cleanup()

    webrtcClient = new WebRTCClient({
      sendSignaling: (message: SignalingMessage) => {
        sendWebRTCSignaling(message)
      },
      onStream: (stream: MediaStream) => {
        connecting.value = false
        const video = videoRef.value
        if (video) {
          video.srcObject = stream
          video.play().catch(() => undefined)
        } else {
          pendingStream.value = stream
        }
        mirroring.value = true
        failed.value = false
        seconds.value = 0
        clearCountInterval()
      },
      onConnectionStateChange: (newState: RTCPeerConnectionState) => {
        if (newState === 'connected') {
          connecting.value = false
        } else if (newState === 'failed' || newState === 'disconnected') {
          connecting.value = false
          failed.value = true
        }
      },
      onError: (error: string) => {
        connecting.value = false
        toast(error, 'error')
        failed.value = true
      },
    })
  }

  const startWebRTC = () => {
    connecting.value = true
    webrtcClient?.startSession(true, false)
  }

  const webrtcSignalingHandler = async (message: SignalingMessage) => {
    if (webrtcClient) {
      await webrtcClient.handleSignalingMessage(message)
    }
  }

  const cleanupWebRTC = () => {
    if (webrtcClient) {
      webrtcClient.cleanup()
      webrtcClient = null
    }
  }

  return { pendingStream, initWebRTCClient, startWebRTC, webrtcSignalingHandler, cleanupWebRTC }
}
