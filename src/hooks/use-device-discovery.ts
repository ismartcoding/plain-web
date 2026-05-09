import { ref } from 'vue'

export interface DiscoveredDevice {
  name: string
  host: string
  port: number
}

const POLL_INTERVAL_MS = 5000

export type DiscoveryStatus = 'idle' | 'searching' | 'ok' | 'permission_denied' | 'network_error'

interface DiscoverDevicesResult {
  devices: DiscoveredDevice[]
  status: 'ok' | 'permission_denied' | 'network_error'
}

export function useDeviceDiscovery() {
  const devices = ref<DiscoveredDevice[]>([])
  const status = ref<DiscoveryStatus>('idle')
  let timer: ReturnType<typeof setTimeout> | null = null
  let active = false
  let scanning = false

  async function scan() {
    if (!__IS_TAURI__ || scanning) return
    scanning = true
    status.value = 'searching'
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<DiscoverDevicesResult | DiscoveredDevice[]>('discover_devices')
      const normalized = Array.isArray(result)
        ? { devices: result, status: 'ok' as const }
        : result
      if (active) {
        devices.value = normalized.devices
        status.value = normalized.status
      }
    } catch (e) {
      console.error('device discovery failed', e)
      if (active) {
        devices.value = []
        status.value = 'network_error'
      }
    } finally {
      scanning = false
      if (active) {
        timer = setTimeout(scan, POLL_INTERVAL_MS)
      }
    }
  }

  function start() {
    if (active) return
    active = true
    scan()
  }

  function stop() {
    active = false
    status.value = 'idle'
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function retry() {
    if (!active) active = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    void scan()
  }

  async function openLanPermissionSettings() {
    if (!__IS_TAURI__) return
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl('x-apple.systempreferences:').catch(async () => {
      await openUrl('https://support.apple.com/guide/mac-help/mchla4f49138/mac')
    })
  }

  return { devices, status, start, stop, retry, openLanPermissionSettings }
}
