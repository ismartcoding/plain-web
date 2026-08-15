import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'

// Wire shape of the Rust `MdnsServiceSnapshot` — mirrors plain-app's
// `MdnsServiceSnapshot` shown on the mDNS debug page.
export interface MdnsServiceSnapshot {
  serviceType: string
  instanceName: string
  instanceFqdn: string
  hostname: string
  port: number
  txtRecords: string[]
  ips: string[]
  complete: boolean
}

// Mirrors plain-app's MdnsDebugPage: while the page is visible it keeps
// periodic mDNS discovery running and refreshes the browser snapshot every
// two seconds; discovery is stopped on exit only when this page started it.
export function useMdns() {
  const { t } = useI18n()
  const hostname = ref('')
  const snapshots = ref<MdnsServiceSnapshot[]>([])
  const saving = ref(false)
  const hostnameInvalid = ref(false)
  let startedByPage = false
  let timer: ReturnType<typeof setInterval> | undefined

  async function loadHostname() {
    if (!__IS_TAURI__) return
    hostname.value = await invoke<string>('mdns_get_hostname')
  }

  // Mirrors plain-app's MdnsAndPortEditDialog validation: non-blank and
  // ending with ".local".
  async function saveHostname(value: string): Promise<boolean> {
    const h = value.trim()
    hostnameInvalid.value = h.length === 0 || !h.endsWith('.local')
    if (hostnameInvalid.value) return false
    saving.value = true
    try {
      await invoke('mdns_set_hostname', { hostname: h })
      hostname.value = h
      toast(t('saved'))
      await refreshSnapshot()
      return true
    } catch (e) {
      console.error('set mdns hostname failed', e)
      hostnameInvalid.value = true
      return false
    } finally {
      saving.value = false
    }
  }

  async function refreshSnapshot() {
    try {
      snapshots.value = await invoke<MdnsServiceSnapshot[]>('mdns_snapshot')
    } catch (e) {
      console.error('mdns_snapshot failed', e)
    }
  }

  async function startBrowsing() {
    if (!__IS_TAURI__) return
    startedByPage = await invoke<boolean>('mdns_start_browse')
    await refreshSnapshot()
    timer = setInterval(refreshSnapshot, 2000)
  }

  function stopBrowsing() {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
    if (startedByPage) {
      startedByPage = false
      invoke('mdns_stop_browse').catch((e) => console.error('mdns_stop_browse failed', e))
    }
  }

  return {
    hostname, snapshots,
    loadHostname, saveHostname, refreshSnapshot, startBrowsing, stopBrowsing,
  }
}
