<template>
  <div class="top-app-bar">
    <div class="title">{{ $t('device_info') }}</div>
  </div>
  <div class="scroll-content">
    <div class="grids">
      <div>
        <section class="card">
          <h5 class="card-title">{{ $t('device') }}</h5>
          <div class="card-body">
            <div class="key-value" v-for="(item, index) in basicInfos" :key="index">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">
                <time v-if="item.isTime" class="time" v-tooltip="formatDateTimeFull(item.value)">{{ formatDateTime(item.value) }} </time>
                <template v-else-if="Array.isArray(item.value)">
                  <div v-for="(it, i) in item.value" :key="i">{{ it }}</div>
                </template>
                <template v-else>
                  {{ item.value }}
                </template>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div>
        <section class="card">
          <h5 class="card-title">{{ $t('system') }}</h5>
          <div class="card-body">
            <div class="key-value" v-for="(item, index) in systemInfos" :key="index">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">
                <time v-if="item.isTime" class="time" v-tooltip="formatDateTimeFull(item.value)">{{ formatDateTime(item.value) }}</time>
                <template v-else-if="Array.isArray(item.value)">
                  <div v-for="(it, i) in item.value" :key="i">{{ it }}</div>
                </template>
                <template v-else>
                  {{ item.value }}
                </template>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div>
        <section class="card">
          <h5 class="card-title">{{ $t('battery') }}</h5>
          <div class="card-body">
            <div class="key-value" v-for="(item, index) in batteryInfos" :key="index">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">
                <time v-if="item.isTime" class="time" v-tooltip="formatDateTimeFull(item.value)">{{ formatDateTime(item.value) }}</time>
                <template v-else-if="Array.isArray(item.value)">
                  <div v-for="(it, i) in item.value" :key="i">{{ it }}</div>
                </template>
                <template v-else>
                  {{ item.value }}
                </template>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { initQuery, deviceInfoGQL } from '@/lib/api/query'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime, formatDateTimeFull, formatSeconds } from '@/lib/format'

const { t } = useI18n()

const basicInfos = ref<any[]>([])
const systemInfos = ref<any[]>([])
const batteryInfos = ref<any[]>([])

const { refetch } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      const d = data.deviceInfo
      basicInfos.value = [
        {
          label: 'device_name',
          value: d.deviceName,
        },
        {
          label: 'model',
          value: d.model,
        },
        {
          label: 'manufacturer',
          value: d.manufacturer,
        },
        {
          label: 'device',
          value: d.device,
        },
        {
          label: 'board',
          value: d.board,
        },
        {
          label: 'hardware',
          value: d.hardware,
        },
        {
          label: 'brand',
          value: d.buildBrand,
        },
        {
          label: 'build_fingerprint',
          value: d.fingerprint,
        },
      ]
      if (d.phoneNumbers.length > 0) {
        basicInfos.value.push({
          label: 'phone_number',
          value: d.phoneNumbers.map((it: any) => it.name + ' ' + it.number),
        })
      }

      systemInfos.value = [
        {
          label: 'android_version',
          value: d.releaseBuildVersion + ' (' + d.sdkVersion + ')',
        },
        {
          label: 'security_patch',
          value: d.securityPatch,
        },
        {
          label: 'bootloader',
          value: d.bootloader,
        },
        {
          label: 'build_number',
          value: d.displayVersion,
        },
        {
          label: 'baseband',
          value: d.radioVersion,
        },
        {
          label: 'java_vm',
          value: d.javaVmVersion,
        },
        {
          label: 'kernel',
          value: d.kernelVersion,
        },
        {
          label: 'opengl_es',
          value: d.glEsVersion,
        },
        {
          label: 'uptime',
          value: formatSeconds(d.uptime / 1000),
        },
      ]

      const battery = data.battery
      batteryInfos.value = [
        {
          label: 'health',
          value: t(`battery_health.${battery.health}`),
        },
        {
          label: 'remaining',
          value: `${battery.level}%`,
        },
        {
          label: 'status',
          value: t(`battery_status.${battery.status}`),
        },
        {
          label: 'power_source',
          value: t(`battery_plugged.${battery.plugged}`),
        },
        {
          label: 'technology',
          value: battery.technology,
        },
        {
          label: 'temperature',
          value: `${battery.temperature} ℃`,
        },
        {
          label: 'voltage',
          value: `${battery.voltage} mV`,
        },
        {
          label: 'capacity',
          value: battery.capacity + ' mAh',
        },
      ]
    }
  },
  document: deviceInfoGQL,
  appApi: true,
})
</script>
<style lang="scss" scoped>
.grids {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  gap: 16px;
  flex: none !important;
}

.card {
  height: 100%;
}
</style>
