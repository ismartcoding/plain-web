/**
 * WebRTC signaling utilities for screen mirroring.
 * Sends signaling messages to the app via GraphQL (encrypted HTTP transport).
 */
import type { SignalingMessage } from './webrtc-client'

import { gqlFetch } from '@/lib/api/gql-client'
import { sendWebRtcSignalingGQL } from '@/lib/api/mutation'

export function sendWebRTCSignaling(message: SignalingMessage) {
  gqlFetch(sendWebRtcSignalingGQL, { payload: message }).catch((error) => {
    console.error('Failed to send WebRTC signaling via GraphQL:', error)
  })
}
