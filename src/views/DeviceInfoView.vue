<template>
  <div class="scroll-content">
    <div class="top-app-bar">
      <div class="title">{{ $t('device_info') }}</div>
    </div>
    <div class="grids">
      <div>
        <section class="card">
          <h5 class="card-title">{{ $t('device') }}</h5>
          <div class="card-body">
            <div v-for="(item, index) in basicInfos" :key="index" class="key-value">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">
                <time v-if="item.isTime" v-tooltip="formatDateTimeFull(item.value)" class="time">{{ formatDateTime(item.value) }} </time>
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
            <div v-for="(item, index) in systemInfos" :key="index" class="key-value">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">
                <time v-if="item.isTime" v-tooltip="formatDateTimeFull(item.value)" class="time">{{ formatDateTime(item.value) }}</time>
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
            <div v-for="(item, index) in batteryInfos" :key="index" class="key-value">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">
                <time v-if="item.isTime" v-tooltip="formatDateTimeFull(item.value)" class="time">{{ formatDateTime(item.value) }}</time>
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
})
</script>
<style lang="scss" scoped>
.scroll-content {
  padding: 0 0 16px 0;
}

.grids {
  display: grid;
  gap: 16px;
  padding: 0 16px 16px 16px;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
}

.card {
  height: 100%;
}

@media (max-width: 1200px) and (min-width: 769px) {
  .grids {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .grids {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 0 12px 12px 12px;
  }

  .scroll-content {
    padding: 0 0 12px 0;
  }
}

</style>
