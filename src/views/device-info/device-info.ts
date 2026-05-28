import toast from '@/components/toaster'
import { initQuery, deviceInfoGQL } from '@/lib/api/query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSeconds, formatFileSize } from '@/lib/format'

interface InfoItem { label: string; value: any; isTime?: boolean }

function formatMemory(bytes: number): string {
  return formatFileSize(bytes)
}

export function useDeviceInfo() {
  const { t } = useI18n()
  const basicInfos = ref<InfoItem[]>([])
  const systemInfos = ref<InfoItem[]>([])
  const hardwareInfos = ref<InfoItem[]>([])
  const platformInfos = ref<InfoItem[]>([])
  const batteryInfos = ref<InfoItem[]>([])

  const { loading, refetch } = initQuery({
    handle: (data: any, error: string) => {
      if (error) { toast(t(error), 'error'); return }
      const d = data.deviceInfo

      basicInfos.value = [
        { label: 'device_name', value: d.name },
        { label: 'platform', value: d.platform },
        { label: 'manufacturer', value: d.manufacturer },
        { label: 'model', value: d.model },
        { label: 'language', value: d.language },
        { label: 'app_version', value: d.appVersion ? (d.appBuildNumber ? `${d.appVersion} (${d.appBuildNumber})` : d.appVersion) : '' },
      ].filter((it) => it.value)
      if (data.sims && data.sims.length > 0) {
        basicInfos.value.push({ label: 'phone_number', value: data.sims.map((s: any) => (s.label ? s.label + ' ' : '') + s.number) })
      }

      systemInfos.value = [
        { label: 'os_name', value: d.osName },
        { label: 'os_version', value: d.osVersion },
        { label: 'kernel', value: d.kernelVersion },
        { label: 'uptime', value: formatSeconds(d.uptime / 1000) },
      ].filter((it) => it.value)

      const disp = d.display
      hardwareInfos.value = [
        { label: 'cpu_arch', value: d.cpuArch },
        { label: 'total_memory', value: d.totalMemory ? formatMemory(d.totalMemory) : '' },
        { label: 'total_storage', value: d.totalStorage ? formatMemory(d.totalStorage) : '' },
        { label: 'screen_resolution', value: disp ? `${disp.width} × ${disp.height}` : '' },
        { label: 'screen_density', value: disp?.density ?? '' },
      ].filter((it) => it.value)

      if (d.android) {
        const a = d.android
        platformInfos.value = [
          { label: 'android_version', value: `${d.osVersion} (SDK ${a.sdkVersion})` },
          { label: 'security_patch', value: a.securityPatch },
          { label: 'bootloader', value: a.bootloader },
          { label: 'build_number', value: a.buildNumber },
          { label: 'baseband', value: a.radioVersion },
          { label: 'hardware', value: a.hardware },
          { label: 'board', value: a.board },
          { label: 'device', value: a.device },
          { label: 'brand', value: a.buildBrand },
          { label: 'java_vm', value: a.javaVmVersion },
          { label: 'opengl_es', value: a.glEsVersion },
          { label: 'build_fingerprint', value: a.fingerprint },
          { label: 'build_time', value: a.buildTime, isTime: true },
        ].filter((it) => it.value)
      } else if (d.desktop) {
        const dt = d.desktop
        platformInfos.value = [
          { label: 'hostname', value: dt.hostname },
          { label: 'cpu_model', value: dt.cpuModel },
          { label: 'gpu_model', value: dt.gpuModel },
          { label: 'desktop_environment', value: dt.desktopEnvironment },
          { label: 'window_manager', value: dt.windowManager },
        ].filter((it) => it.value)
      } else {
        platformInfos.value = []
      }

      const battery = data.battery
      if (battery) {
        batteryInfos.value = [
          { label: 'health', value: t(`battery_health.${battery.health}`) },
          { label: 'remaining', value: `${battery.level}%` },
          { label: 'status', value: t(`battery_status.${battery.status}`) },
          { label: 'power_source', value: t(`battery_plugged.${battery.plugged}`) },
          { label: 'technology', value: battery.technology },
          { label: 'temperature', value: `${battery.temperature} ℃` },
          { label: 'voltage', value: `${battery.voltage} mV` },
          { label: 'capacity', value: battery.capacity + ' mAh' },
        ]
      } else {
        batteryInfos.value = []
      }
    },
    document: deviceInfoGQL,
  })

  return { basicInfos, systemInfos, hardwareInfos, platformInfos, batteryInfos, loading, refetch }
}
