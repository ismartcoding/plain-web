import { invoke } from '@tauri-apps/api/core'
import { ref } from 'vue'

export interface DeviceIdentity {
  clientId: string
  deviceName: string
  publicKey: string
}

export function useDeviceIdentity() {
  const identity = ref<DeviceIdentity | null>(null)
  const loading = ref(false)
  const saving = ref(false)

  async function load() {
    if (!__IS_TAURI__) return
    loading.value = true
    try {
      identity.value = await invoke<DeviceIdentity>('get_device_identity')
    } catch (e) {
      console.error('get_device_identity failed', e)
    } finally {
      loading.value = false
    }
  }

  async function saveName(name: string) {
    if (!__IS_TAURI__) return
    saving.value = true
    try {
      await invoke('set_device_name', { name })
      if (identity.value) {
        identity.value = { ...identity.value, deviceName: name }
      }
    } catch (e) {
      console.error('set_device_name failed', e)
    } finally {
      saving.value = false
    }
  }

  return { identity, loading, saving, load, saveName }
}
