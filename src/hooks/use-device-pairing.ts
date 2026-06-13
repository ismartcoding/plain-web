import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { markRaw, ref, watch } from 'vue'
import { openModal } from '@/components/modal'

export type PairingStatus = 'idle' | 'requesting' | 'waiting' | 'success' | 'failed' | 'cancelled'

export interface PairingRequest {
  fromId: string
  fromName: string
  port: number
  deviceType: string
  ecdhPublicKey: string
  signaturePublicKey: string
  timestamp: number
  ips: string[]
  signature: string
}

interface PairingEventPayload {
  deviceId: string
  deviceName: string
  kind:
    | { type: 'incomingRequest'; request: PairingRequest; senderIp: string }
    | { type: 'success' }
    | { type: 'failed'; reason: string }
    | { type: 'cancelled' }
}

// Module-level singleton state so the listener stays active for the app lifetime
// and is shared across all components that call this composable.
const status = ref<PairingStatus>('idle')
const errorMessage = ref('')
const pairedPeerId = ref('')
/** Pending incoming request — a global modal is opened when this is set. */
const incomingRequest = ref<{ request: PairingRequest; senderIp: string } | null>(null)

let unlisten: UnlistenFn | null = null
let listenerInitialized = false
let modalWatcherInitialized = false

async function allowPairing(request: PairingRequest, senderIp: string) {
  try {
    await invoke('respond_pair_device', {
      requestJson: JSON.stringify(request),
      senderIp,
      accepted: true,
    })
    status.value = 'waiting'
  } catch (e) {
    status.value = 'failed'
    errorMessage.value = String(e)
  } finally {
    incomingRequest.value = null
  }
}

async function denyPairing(request: PairingRequest, senderIp: string) {
  try {
    await invoke('respond_pair_device', {
      requestJson: JSON.stringify(request),
      senderIp,
      accepted: false,
    })
  } finally {
    incomingRequest.value = null
    status.value = 'idle'
  }
}

function initListener() {
  if (listenerInitialized || !__IS_TAURI__) return
  listenerInitialized = true
  listen<PairingEventPayload>('pairing-event', ({ payload }) => {
    const k = payload.kind
    if (k.type === 'incomingRequest') {
      incomingRequest.value = { request: k.request, senderIp: k.senderIp }
      status.value = 'waiting'
    } else if (k.type === 'success') {
      pairedPeerId.value = payload.deviceId
      status.value = 'success'
      incomingRequest.value = null
    } else if (k.type === 'failed') {
      status.value = 'failed'
      errorMessage.value = k.reason
      incomingRequest.value = null
    } else if (k.type === 'cancelled') {
      status.value = 'cancelled'
      incomingRequest.value = null
    }
  }).then((fn) => {
    unlisten = fn
  })
}

async function initModalWatcher() {
  if (modalWatcherInitialized) return
  modalWatcherInitialized = true
  // `IncomingPairRequestModal.vue` is otherwise unreferenced anywhere, so
  // the dynamic import still splits it into its own chunk (loaded only when
  // an incoming pairing request fires). `openModal` is statically imported
  // above since `@/components/modal` is already in the main graph.
  const IncomingPairRequestModal = markRaw((await import('@/views/chat/IncomingPairRequestModal.vue')).default)
  watch(incomingRequest, (req) => {
    if (!req) return
    openModal(IncomingPairRequestModal, {
      request: req.request,
      senderIp: req.senderIp,
      onAllow: () => allowPairing(req.request, req.senderIp),
      onDeny: () => denyPairing(req.request, req.senderIp),
    })
  })
}

export function useDevicePairing() {
  initListener()
  void initModalWatcher()

  async function pairDevice(device: {
    id: string
    name: string
    ip: string
    port: number
    deviceType: string
  }) {
    status.value = 'requesting'
    errorMessage.value = ''
    try {
      await invoke('pair_device', {
        deviceId: device.id,
        deviceName: device.name,
        deviceIp: device.ip,
      })
      status.value = 'waiting'
    } catch (e) {
      status.value = 'failed'
      errorMessage.value = String(e)
    }
  }

  async function cancelPairing(deviceId: string) {
    try {
      await invoke('cancel_pair_device', { deviceId })
    } finally {
      status.value = 'cancelled'
    }
  }

  function reset() {
    status.value = 'idle'
    errorMessage.value = ''
    incomingRequest.value = null
    pairedPeerId.value = ''
  }

  return {
    status,
    errorMessage,
    pairedPeerId,
    incomingRequest,
    pairDevice,
    allowPairing,
    denyPairing,
    cancelPairing,
    reset,
  }
}
