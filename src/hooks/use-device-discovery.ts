import { ref } from 'vue'
import { initMutation, startDiscoveringGQL, stopDiscoveringGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'

export interface DiscoveredDevice {
  id: string
  name: string
  host: string
  ip: string
  port: number
  deviceType: string
}

export type DiscoveryStatus = 'idle' | 'searching' | 'ok' | 'permission_denied' | 'network_error'

const devices = ref<DiscoveredDevice[]>([])
const status = ref<DiscoveryStatus>('idle')

let activeCount = 0
let listenerInitialized = false

function ensureListener() {
  if (listenerInitialized) return
  listenerInitialized = true

  emitter.on('nearby_device_found', (raw: any) => {
    if (!raw || !raw.id) return
    const device: DiscoveredDevice = {
      id: raw.id,
      name: raw.name ?? '',
      host: raw.host ?? `${raw.ip ?? ''}:${raw.port ?? ''}`,
      ip: raw.ip ?? '',
      port: raw.port ?? 0,
      deviceType: raw.deviceType ?? '',
    }
    const existing = devices.value.findIndex((d) => d.id === device.id)
    if (existing >= 0) {
      const next = devices.value.slice()
      next[existing] = { ...next[existing], ...device }
      devices.value = next
    } else {
      devices.value = [...devices.value, device]
    }
    status.value = 'ok'
  })

  emitter.on('nearby_discovery_started', () => {
    status.value = 'searching'
  })

  emitter.on('nearby_discovery_stopped', (payload: any) => {
    status.value = payload?.reason === 'no_receivers' ? 'network_error' : 'idle'
  })
}

const { mutate: startMutate } = initMutation({ document: startDiscoveringGQL }, false)
const { mutate: stopMutate } = initMutation({ document: stopDiscoveringGQL }, false)

export function useDeviceDiscovery() {
  ensureListener()

  async function start() {
    activeCount += 1
    if (activeCount > 1) return
    status.value = 'searching'
    await startMutate()
  }

  async function stop() {
    if (activeCount === 0) return
    activeCount -= 1
    if (activeCount > 0) return
    await stopMutate()
    status.value = 'idle'
    devices.value = []
  }

  function retry() {
    status.value = 'searching'
    void startMutate()
  }

  async function openLanPermissionSettings() {
    if (__IS_TAURI__) {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl('x-apple.systempreferences:').catch(async () => {
        await openUrl('https://support.apple.com/guide/mac-help/mchla4f49138/mac')
      })
      return
    }
    if (typeof window === 'undefined') return
    window.location.href = 'x-apple.systempreferences:'
  }

  return { devices, status, start, stop, retry, openLanPermissionSettings }
}