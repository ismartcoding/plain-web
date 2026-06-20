import { reactive } from 'vue'
import {
  cancelPairingGQL,
  initMutation,
  pairDeviceGQL,
  respondToPairingGQL,
} from '@/lib/api/mutation'
import type { PairingRequest, PairingResult } from '@/lib/pairing-types'
import emitter from '@/plugins/eventbus'
import { useChatStore } from '@/stores/chat'

export type { PairingRequest }
export type PairingStatus = 'idle' | 'requesting' | 'waiting' | 'success' | 'failed' | 'cancelled'

const pairingStatusMap = reactive(new Map<string, PairingStatus>())

let listenerInitialized = false

const { mutate: pairDeviceMutate } = initMutation({ document: pairDeviceGQL }, false)
const { mutate: cancelPairingMutate } = initMutation({ document: cancelPairingGQL }, false)
const { mutate: respondToPairingMutate } = initMutation({ document: respondToPairingGQL }, false)

export async function allowPairing(request: PairingRequest) {
  await respondToPairingMutate({ input: request, accepted: true })
  pairingStatusMap.delete(request.fromId)
}

export async function denyPairing(request: PairingRequest) {
  await respondToPairingMutate({ input: request, accepted: false })
}

function initListener() {
  if (listenerInitialized) return
  listenerInitialized = true

  emitter.on('pairing_success', (result: PairingResult) => {
    pairingStatusMap.set(result.deviceId, 'success')
    useChatStore().fetchPeers()
  })

  emitter.on('pairing_failed', (result: PairingResult) => {
    pairingStatusMap.set(result.deviceId, 'failed')
  })

  emitter.on('pairing_canceled', (result: PairingResult) => {
    pairingStatusMap.set(result.deviceId, 'cancelled')
  })
}

export interface PairingDeviceInput {
  id: string
  name: string
  ips: string[]
  port: number
  deviceType: string
  version?: string
  platform?: string
  lastSeen?: string
}

export function useDevicePairing() {
  initListener()

  async function pairDevice(device: PairingDeviceInput) {
    pairingStatusMap.set(device.id, 'requesting')
    const r = await pairDeviceMutate({ input: device })
    if (r != null) {
      pairingStatusMap.set(device.id, 'waiting')
    } else {
      pairingStatusMap.set(device.id, 'failed')
    }
  }

  async function cancelPairing(deviceId: string) {
    if (pairingStatusMap.get(deviceId) === 'success') return
    await cancelPairingMutate({ deviceId })
  }

  return {
    pairingStatusMap,
    pairDevice,
    cancelPairing,
  }
}
