import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'
import emitter from '@/plugins/eventbus'
import { setLocalServerPort, setLocalServerHttpsPort } from '@/lib/api/api'
import type { VSelectOption } from '@/components/base/VSelect.vue'

// Mirrors plain-app's `web/HttpServerPorts.kt` — fixed port candidates
// the user can pick from in the edit dialog. The server tries each in
// order and falls back to an OS-assigned port only when every candidate
// is taken.
const HTTP_PORTS = [8080, 8180, 8280, 8380, 8480, 8580, 8680, 8780, 8880, 8980]
const HTTPS_PORTS = [8043, 8143, 8243, 8343, 8443, 8543, 8643, 8743, 8843, 8943]

function portOptions(candidates: number[], current: number): VSelectOption[] {
  const list: VSelectOption[] = candidates.map((p) => ({ value: p, label: String(p) }))
  if (current && !candidates.includes(current)) {
    list.unshift({ value: current, label: `${current}` })
  }
  return list
}

export function useHttpServer() {
  const { t } = useI18n()
  const { app } = storeToRefs(useTempStore())
  const ips = ref<string[]>([])
  const saving = ref(false)

  async function loadIps() {
    if (!__IS_TAURI__) return
    try {
      ips.value = await invoke<string[]>('local_ipv4_strs')
    } catch (e) {
      console.error('local_ipv4_strs failed', e)
    }
  }

  async function savePort(kind: 'http' | 'https', port: number) {
    if (!__IS_TAURI__) return
    saving.value = true
    try {
      const cmd = kind === 'http' ? 'set_http_port' : 'set_https_port'
      await invoke(cmd, { port })
      await invoke('restart_server')
      const [httpPort, httpsPort] = await Promise.all([
        invoke<number>('local_server_port'),
        invoke<number>('local_server_https_port'),
      ])
      setLocalServerPort(httpPort)
      setLocalServerHttpsPort(httpsPort)
      emitter.emit('refetch_app')
      toast(t('saved'))
    } catch (e) {
      console.error('save port failed', e)
      toast(t('failed'), 'error')
    } finally {
      saving.value = false
    }
  }

  const httpPort = computed(() => app.value?.httpPort ?? 0)
  const httpsPort = computed(() => app.value?.httpsPort ?? 0)
  const httpPortOptions = computed(() => portOptions(HTTP_PORTS, httpPort.value))
  const httpsPortOptions = computed(() => portOptions(HTTPS_PORTS, httpsPort.value))
  const httpAddresses = computed(() =>
    ips.value.map((ip) => `http://${ip}:${httpPort.value}`)
  )
  const httpsAddresses = computed(() =>
    ips.value.map((ip) => `https://${ip}:${httpsPort.value}`)
  )

  return {
    ips, httpPort, httpsPort, httpAddresses, httpsAddresses,
    httpPortOptions, httpsPortOptions, saving, loadIps, savePort,
  }
}
