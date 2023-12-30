<template>
  <div class="page-container">
    <div class="main">
      <div class="v-toolbar">
        <breadcrumb :current="() => $t('device_info')" />
      </div>
      <div class="panel-container">
        <div class="grid">
          <div class="g-col-6 g-col-md-4">
            <section class="card">
              <div class="card-body">
                <h5 class="card-title">{{ $t('device') }}</h5>
                <p class="card-text">
                <div class="key-value" v-for="item in basicInfos">
                  <div class="key">{{ $t(item.label) }}</div>
                  <div class="value">
                    <span v-if="item.isTime" class="time" v-tooltip="formatDateTimeFull(item.value)">{{
                      formatDateTime(item.value) }}
                    </span>
                    <template v-else-if="Array.isArray(item.value)">
                      <div v-for="it in item.value">{{ it }}</div>
                    </template>
                    <template v-else>
                      {{ item.value }}
                    </template>
                  </div>
                </div>
                </p>
              </div>
            </section>
          </div>
          <div class="g-col-6 g-col-md-4">
            <section class="card">
              <div class="card-body">
                <h5 class="card-title">{{ $t('system') }}</h5>
                <p class="card-text">
                <div class="key-value" v-for="item in systemInfos">
                  <div class="key">{{ $t(item.label) }}</div>
                  <div class="value">
                    <span v-if="item.isTime" class="time" v-tooltip="formatDateTimeFull(item.value)">{{
                      formatDateTime(item.value) }}</span>
                    <template v-else-if="Array.isArray(item.value)">
                      <div v-for="it in item.value">{{ it }}</div>
                    </template>
                    <template v-else>
                      {{ item.value }}
                    </template>
                  </div>
                </div>
                </p>
              </div>
            </section>
          </div>
          <div class="g-col-6 g-col-md-4">
            <section class="card">
              <div class="card-body">
                <h5 class="card-title">{{ $t('battery') }}</h5>
                <p class="card-text">
                <div class="key-value" v-for="item in batteryInfos">
                  <div class="key">{{ $t(item.label) }}</div>
                  <div class="value">
                    <span v-if="item.isTime" class="time" v-tooltip="formatDateTimeFull(item.value)">{{
                      formatDateTime(item.value) }}</span>
                    <template v-else-if="Array.isArray(item.value)">
                      <div v-for="it in item.value">{{ it }}</div>
                    </template>
                    <template v-else>
                      {{ item.value }}
                    </template>
                  </div>
                </div>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { initQuery, deviceInfoGQL } from '@/lib/api/query'
import { ref } from 'vue';
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
          value: d.deviceName
        },
        {
          label: 'model',
          value: d.model
        },
        {
          label: 'manufacturer',
          value: d.manufacturer
        },
        {
          label: 'device',
          value: d.device
        },
        {
          label: 'board',
          value: d.board
        },
        {
          label: 'hardware',
          value: d.hardware
        },
        {
          label: 'brand',
          value: d.buildBrand
        },
        {
          label: 'build_fingerprint',
          value: d.fingerprint
        },
      ]
      if (d.phoneNumbers.length > 0) {
        basicInfos.value.push({
          label: 'phone_number',
          value: d.phoneNumbers.map((it: any) => it.name + ' ' + it.number)
        })
      }


      systemInfos.value = [
        {
          label: 'android_version',
          value: d.releaseBuildVersion + ' (' + d.sdkVersion + ')'
        },
        {
          label: 'security_patch',
          value: d.securityPatch
        },
        {
          label: 'bootloader',
          value: d.bootloader
        },
        {
          label: 'build_number',
          value: d.displayVersion
        },
        {
          label: 'baseband',
          value: d.radioVersion
        },
        {
          label: 'java_vm',
          value: d.javaVmVersion
        },
        {
          label: 'kernel',
          value: d.kernelVersion
        },
        {
          label: 'opengl_es',
          value: d.glEsVersion
        },
        {
          label: 'uptime',
          value: formatSeconds(d.uptime / 1000)
        },
      ]

      const battery = data.battery
      batteryInfos.value = [
        {
          label: 'health',
          value: t(`battery_health.${battery.health}`)
        },
        {
          label: 'remaining',
          value: `${battery.level}%`
        },
        {
          label: 'status',
          value: t(`battery_status.${battery.status}`)
        },
        {
          label: 'power_source',
          value: t(`battery_plugged.${battery.plugged}`)
        },
        {
          label: 'technology',
          value: battery.technology
        },
        {
          label: 'temperature',
          value: `${battery.temperature} ℃`
        },
        {
          label: 'voltage',
          value: `${battery.voltage} mV`
        },
        {
          label: 'capacity',
          value: battery.capacity + ' mAh'
        },
      ]
    }
  },
  document: deviceInfoGQL,
  appApi: true,
})

</script>
<style lang="scss" scoped>
.main {
  height: 100%;
}

.panel-container {
  position: relative;
  height: 100%;
  min-height: calc(100vh - 150px);
}

.key-value {
  display: flex;
  flex-direction: row;
  padding-block-end: 8px;

  .key {
    font-weight: bold;
    margin-right: 5px;
    width: 30%;
  }

  .value {
    width: 70%;
    word-break: break-all;
  }
}
</style>
