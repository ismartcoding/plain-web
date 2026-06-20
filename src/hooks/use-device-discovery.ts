import { ref } from 'vue'
import { initMutation, startDiscoveryGQL, stopDiscoveryGQL } from '@/lib/api/mutation'
import { gqlFetch } from '@/lib/api/gql-client'
import { isDiscoveringGQL } from '@/lib/api/query'
import emitter from '@/plugins/eventbus'

export interface DiscoveredDevice {
  id: string
  name: string
  host: string
  ip: string
  port: number
  deviceType: string
  /** All advertised IPs from the discover reply — used as unicast
   * candidates when initiating pairing. The first non-empty entry is
   * picked by the GraphQL `pairDevice` resolver. */
  ips?: string[]
  /** App version reported by the discovered device (e.g. "1.2.3"). */
  version?: string
  /** Platform string reported by the discovered device (e.g. "android"). */
  platform?: string
  /** ISO-8601 timestamp of when the device was last seen. */
  lastSeen?: string
}

export type DiscoveryStatus = 'idle' | 'searching' | 'ok' | 'permission_denied' | 'network_error'

const devices = ref<DiscoveredDevice[]>([])
const status = ref<DiscoveryStatus>('idle')

let activeCount = 0
let listenerInitialized = false
let pollTimer: ReturnType<typeof setInterval> | null = null

async function checkAndEnsureDiscovering() {
  if (activeCount === 0) return
  try {
    const r = await gqlFetch<{ isDiscovering: boolean }>(isDiscoveringGQL)
    if (!r.errors && r.data?.isDiscovering !== true) {
      await startMutate()
    }
  } catch {
    // ignore polling errors
  }
}

function startPolling() {
  if (pollTimer !== null) return
  pollTimer = setInterval(checkAndEnsureDiscovering, 5_000)
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

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
      ips: Array.isArray(raw.ips) ? raw.ips : [],
      version: raw.version,
      platform: raw.platform,
      lastSeen: raw.lastSeen,
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

const { mutate: startMutate } = initMutation({ document: startDiscoveryGQL }, false)
const { mutate: stopMutate } = initMutation({ document: stopDiscoveryGQL }, false)

export function useDeviceDiscovery() {
  ensureListener()

  async function start() {
    activeCount += 1
    if (activeCount > 1) return
    status.value = 'searching'
    await startMutate()
    startPolling()
  }

  async function stop() {
    if (activeCount === 0) return
    activeCount -= 1
    if (activeCount > 0) return
    stopPolling()
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