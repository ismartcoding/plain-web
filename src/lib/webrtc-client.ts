/**
 * WebRTC client for screen mirroring.
 * Handles PeerConnection creation, SDP negotiation, and ICE candidate exchange.
 * Uses the existing WebSocket connection for signaling.
 */

export interface SignalingMessage {
  type: string // "offer", "answer", "ice_candidate", "control"
  sdp?: string
  sdpMid?: string
  sdpMLineIndex?: number
  candidate?: string
}

export interface WebRTCClientOptions {
  sendSignaling: (message: SignalingMessage) => void
  onStream: (stream: MediaStream) => void
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
  onError: (error: string) => void
}

export class WebRTCClient {
  private pc: RTCPeerConnection | null = null
  private options: WebRTCClientOptions
  private audioEnabled = false
  private remoteDescriptionSet = false
  private pendingIceCandidates: { candidate: string; sdpMid?: string; sdpMLineIndex?: number }[] = []

  constructor(options: WebRTCClientOptions) {
    this.options = options
  }

  async startSession(enableAudio: boolean, asOfferer: boolean = true): Promise<void> {
    this.audioEnabled = enableAudio
    this.cleanup()
    this.remoteDescriptionSet = false
    this.pendingIceCandidates = []

    const config: RTCConfiguration = {
      iceServers: [],
      iceCandidatePoolSize: 0,
    }

    this.pc = new RTCPeerConnection(config)

    this.pc.ontrack = (event: RTCTrackEvent) => {
      if (event.streams && event.streams.length > 0) {
        this.options.onStream(event.streams[0])
      } else {
        const stream = new MediaStream()
        stream.addTrack(event.track)
        this.options.onStream(stream)
      }
    }

    this.pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        this.options.sendSignaling({
          type: 'ice_candidate',
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid ?? undefined,
          sdpMLineIndex: event.candidate.sdpMLineIndex ?? undefined,
        })
      }
    }

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.options.onConnectionStateChange(this.pc.connectionState)
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.pc?.iceConnectionState)
    }

    this.pc.addTransceiver('video', { direction: 'recvonly' })
    if (enableAudio) {
      this.pc.addTransceiver('audio', { direction: 'recvonly' })
    }

    if (asOfferer) {
      try {
        const offer = await this.pc.createOffer()
        await this.pc.setLocalDescription(offer)

        this.options.sendSignaling({
          type: 'offer',
          sdp: offer.sdp,
          sdpMid: enableAudio ? 'audio_enabled' : 'audio_disabled',
        })
      } catch (error) {
        this.options.onError(`Failed to create offer: ${error}`)
      }
    } else {
      // Notify the remote side that we are ready to receive an offer
      this.options.sendSignaling({ type: 'ready' })
    }
  }

  async handleOffer(sdp: string): Promise<void> {
    if (!this.pc) {
      console.error('PeerConnection not initialized')
      return
    }

    try {
      const offer = new RTCSessionDescription({ type: 'offer', sdp })
      await this.pc.setRemoteDescription(offer)
      this.remoteDescriptionSet = true
      await this.flushPendingIceCandidates()
      const answer = await this.pc.createAnswer()
      await this.pc.setLocalDescription(answer)
      this.options.sendSignaling({
        type: 'answer',
        sdp: answer.sdp,
      })
    } catch (error) {
      this.options.onError(`Failed to handle offer: ${error}`)
    }
  }

  async handleAnswer(sdp: string): Promise<void> {
    if (!this.pc) {
      console.error('PeerConnection not initialized')
      return
    }

    try {
      const answer = new RTCSessionDescription({ type: 'answer', sdp })
      await this.pc.setRemoteDescription(answer)
      this.remoteDescriptionSet = true
      await this.flushPendingIceCandidates()
      console.log('Remote description (answer) set successfully')
    } catch (error) {
      this.options.onError(`Failed to set remote description: ${error}`)
    }
  }

  async handleIceCandidate(candidate: string, sdpMid?: string, sdpMLineIndex?: number): Promise<void> {
    if (!this.pc) {
      console.error('PeerConnection not initialized')
      return
    }

    if (!this.remoteDescriptionSet) {
      this.pendingIceCandidates.push({ candidate, sdpMid, sdpMLineIndex })
      return
    }

    try {
      await this.pc.addIceCandidate(
        new RTCIceCandidate({
          candidate,
          sdpMid: sdpMid ?? '',
          sdpMLineIndex: sdpMLineIndex ?? 0,
        })
      )
    } catch (error) {
      console.error('Failed to add ICE candidate:', error)
    }
  }

  private async flushPendingIceCandidates(): Promise<void> {
    const candidates = this.pendingIceCandidates
    this.pendingIceCandidates = []
    for (const c of candidates) {
      try {
        await this.pc?.addIceCandidate(
          new RTCIceCandidate({
            candidate: c.candidate,
            sdpMid: c.sdpMid ?? '',
            sdpMLineIndex: c.sdpMLineIndex ?? 0,
          })
        )
      } catch (error) {
        console.error('Failed to add buffered ICE candidate:', error)
      }
    }
  }

  sendControlEvent(event: ControlEvent): void {
    this.options.sendSignaling({
      type: 'control',
      sdp: JSON.stringify(event),
    })
  }

  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled
    if (this.pc) {
      const receivers = this.pc.getReceivers()
      for (const receiver of receivers) {
        if (receiver.track?.kind === 'audio') {
          receiver.track.enabled = enabled
        }
      }
    }
  }

  isAudioEnabled(): boolean {
    return this.audioEnabled
  }

  async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    switch (message.type) {
      case 'offer':
        if (message.sdp) {
          await this.handleOffer(message.sdp)
        }
        break
      case 'answer':
        if (message.sdp) {
          await this.handleAnswer(message.sdp)
        }
        break
      case 'ice_candidate':
        if (message.candidate) {
          await this.handleIceCandidate(message.candidate, message.sdpMid, message.sdpMLineIndex)
        }
        break
      default:
        console.warn('Unknown signaling message type:', message.type)
    }
  }

  cleanup(): void {
    this.remoteDescriptionSet = false
    this.pendingIceCandidates = []
    if (this.pc) {
      this.pc.ontrack = null
      this.pc.onicecandidate = null
      this.pc.onconnectionstatechange = null
      this.pc.oniceconnectionstatechange = null
      this.pc.close()
      this.pc = null
    }
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.pc?.connectionState ?? null
  }
}

export interface ControlEvent {
  action: string
  x?: number
  y?: number
  endX?: number
  endY?: number
  duration?: number
  key?: string
  deltaX?: number
  deltaY?: number
}
