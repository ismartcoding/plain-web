import {
  cancelPairingGQL,
  initMutation,
  pairDeviceGQL,
  respondToPairingGQL,
} from '@/lib/api/mutation'
import type { PairingRequest, PairingResult } from '@/lib/pairing-types'
import { reactive } from 'vue'

export type { PairingRequest }
export type PairingStatus = 'idle' | 'requesting' | 'waiting' | 'success' | 'failed' | 'cancelled'

export type DeviceState = 'unpaired' | 'pairing' | 'paired' | 'unpairing' | 'canceling'
const deviceStates = reactive(new Map<string, DeviceState>())
const { mutate: pairDeviceMutate } = initMutation({ document: pairDeviceGQL }, false)
const { mutate: cancelPairingMutate } = initMutation({ document: cancelPairingGQL }, false)
const { mutate: respondToPairingMutate } = initMutation({ document: respondToPairingGQL }, false)

export async function allowPairing(request: PairingRequest) {
  await respondToPairingMutate({ input: request, accepted: true })
}

export async function denyPairing(request: PairingRequest) {
  await respondToPairingMutate({ input: request, accepted: false })
}

export interface PairingDeviceInput {
  id: string
  name: string
  ips: string[]
  port: number
  deviceType: string
  version: string
  platform: string
  lastSeen: string
  discoveryMethods: string[]
}

export function useDevicePairing() {
  async function pairDevice(device: PairingDeviceInput) {
    pairDeviceMutate({ input: device })
  }

  async function cancelPairing(deviceId: string) {
    await cancelPairingMutate({ deviceId })
  }

  return {
    pairDevice,
    cancelPairing,
    deviceStates,
  }
}
