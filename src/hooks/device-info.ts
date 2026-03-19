import toast from '@/components/toaster'
import { initQuery, deviceInfoGQL } from '@/lib/api/query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatSeconds } from '@/lib/format'

interface InfoItem { label: string; value: any; isTime?: boolean }

export function useDeviceInfo() {
  const { t } = useI18n()
  const basicInfos = ref<InfoItem[]>([])
  const systemInfos = ref<InfoItem[]>([])
  const batteryInfos = ref<InfoItem[]>([])

  initQuery({
    handle: (data: any, error: string) => {
      if (error) { toast(t(error), 'error'); return }
      const d = data.deviceInfo
      basicInfos.value = [
        { label: 'device_name', value: d.deviceName },
        { label: 'model', value: d.model },
        { label: 'manufacturer', value: d.manufacturer },
        { label: 'device', value: d.device },
        { label: 'board', value: d.board },
        { label: 'hardware', value: d.hardware },
        { label: 'brand', value: d.buildBrand },
        { label: 'build_fingerprint', value: d.fingerprint },
      ]
      if (d.phoneNumbers.length > 0) {
        basicInfos.value.push({ label: 'phone_number', value: d.phoneNumbers.map((it: any) => it.name + ' ' + it.number) })
      }
      systemInfos.value = [
        { label: 'android_version', value: d.releaseBuildVersion + ' (' + d.sdkVersion + ')' },
        { label: 'security_patch', value: d.securityPatch },
        { label: 'bootloader', value: d.bootloader },
        { label: 'build_number', value: d.displayVersion },
        { label: 'baseband', value: d.radioVersion },
        { label: 'java_vm', value: d.javaVmVersion },
        { label: 'kernel', value: d.kernelVersion },
        { label: 'opengl_es', value: d.glEsVersion },
        { label: 'uptime', value: formatSeconds(d.uptime / 1000) },
      ]
      const battery = data.battery
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
    },
    document: deviceInfoGQL,
  })

  return { basicInfos, systemInfos, batteryInfos }
}
