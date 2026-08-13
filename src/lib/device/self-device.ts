import { invoke } from '@tauri-apps/api/core'

export interface SelfDevice {
  name: string
  host: string
}

export async function loadSelfDevice(): Promise<SelfDevice | null> {
  if (!__IS_TAURI__) return null
  try {
    const [identity, ips, port] = await Promise.all([
      invoke<{ deviceName: string }>('get_device_identity'),
      invoke<string[]>('local_ipv4_strs'),
      invoke<number>('local_server_https_port'),
    ])
    const ip = ips.find((v) => !v.startsWith('127.')) || ips[0] || ''
    return { name: identity.deviceName || '', host: ip ? `${ip}:${port}` : '' }
  } catch (e) {
    console.error('load self device failed', e)
    return null
  }
}
