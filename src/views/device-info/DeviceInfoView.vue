<template>
  <Teleport v-if="isActive" to="#header-end-slot" defer>
    <v-icon-button v-tooltip="$t('refresh')" :loading="loading" @click="refetch">
      <i-material-symbols:refresh-rounded />
    </v-icon-button>
  </Teleport>
  <div class="scroll-content">
    <div class="grids">
      <div v-if="isTauri">
        <section class="card">
          <h5 class="card-title">{{ $t('http_server') }}</h5>
          <div class="card-body">
            <div class="key-value">
              <div class="key">{{ $t('status') }}</div>
              <div class="value">
                <span class="running-dot"></span>{{ $t('running') }}
              </div>
            </div>
            <div class="key-value">
              <div class="key">{{ $t('http_port') }}</div>
              <div class="value">
                {{ httpPort }}
                <v-icon-button class="btn-sm" @click="openPortDialog('http')">
                  <i-material-symbols:edit-rounded />
                </v-icon-button>
              </div>
            </div>
            <div class="key-value">
              <div class="key">{{ $t('https_port') }}</div>
              <div class="value">
                {{ httpsPort }}
                <v-icon-button class="btn-sm" @click="openPortDialog('https')">
                  <i-material-symbols:edit-rounded />
                </v-icon-button>
              </div>
            </div>
            <div v-if="httpAddresses.length" class="key-value">
              <div class="key">{{ $t('http_addresses') }}</div>
              <div class="value">
                <div v-for="addr in httpAddresses" :key="addr" class="address-row">{{ addr }}</div>
              </div>
            </div>
            <div v-if="httpsAddresses.length" class="key-value">
              <div class="key">{{ $t('https_addresses') }}</div>
              <div class="value">
                <div v-for="addr in httpsAddresses" :key="addr" class="address-row">{{ addr }}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div>
        <section class="card">
          <h5 class="card-title">{{ $t('device') }}</h5>
          <div class="card-body">
            <div v-for="(item, index) in basicInfos" :key="index" class="key-value">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">
                <template v-if="Array.isArray(item.value)">
                  <div v-for="(it, i) in item.value" :key="i">{{ it }}</div>
                </template>
                <template v-else>{{ item.value }}</template>
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
              <div class="value">{{ item.value }}</div>
            </div>
          </div>
        </section>
      </div>
      <div v-if="hardwareInfos.length">
        <section class="card">
          <h5 class="card-title">{{ $t('hardware') }}</h5>
          <div class="card-body">
            <div v-for="(item, index) in hardwareInfos" :key="index" class="key-value">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">{{ item.value }}</div>
            </div>
          </div>
        </section>
      </div>
      <div v-if="platformInfos.length">
        <section class="card">
          <h5 class="card-title">{{ $t('platform_info') }}</h5>
          <div class="card-body">
            <div v-for="(item, index) in platformInfos" :key="index" class="key-value">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">
                <time v-if="item.isTime" v-tooltip="formatDateTimeFull(item.value)" class="time">{{ formatDateTime(item.value) }}</time>
                <template v-else>{{ item.value }}</template>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div v-if="batteryInfos.length">
        <section class="card">
          <h5 class="card-title">{{ $t('battery') }}</h5>
          <div class="card-body">
            <div v-for="(item, index) in batteryInfos" :key="index" class="key-value">
              <div class="key">{{ $t(item.label) }}</div>
              <div class="value">{{ item.value }}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
  <v-modal v-if="portDialogVisible" width="360px" @close="closePortDialog">
    <template #headline>{{ $t('edit_port') }}</template>
    <template #content>
      <div class="port-dialog-body">
        <v-select
          v-model="portDialogValue"
          :options="portDialogKind === 'http' ? httpPortOptions : httpsPortOptions"
          :placeholder="$t('port')"
        />
      </div>
    </template>
    <template #actions>
      <v-filled-button :loading="saving" @click="confirmPort">{{ $t('confirm') }}</v-filled-button>
    </template>
  </v-modal>
</template>

<script setup lang="ts">
import { ref, onActivated, onDeactivated } from 'vue'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { useDeviceInfo } from './device-info'
import { useHttpServer } from './use-http-server'

const isActive = ref(false)
const isTauri = __IS_TAURI__
onActivated(() => { isActive.value = true })
onDeactivated(() => { isActive.value = false })

const { basicInfos, systemInfos, hardwareInfos, platformInfos, batteryInfos, loading, refetch } = useDeviceInfo()

const {
  httpPort, httpsPort, httpAddresses, httpsAddresses,
  httpPortOptions, httpsPortOptions, saving, loadIps, savePort,
} = useHttpServer()

const portDialogVisible = ref(false)
const portDialogKind = ref<'http' | 'https'>('http')
const portDialogValue = ref<number | undefined>(0)

function openPortDialog(kind: 'http' | 'https') {
  portDialogKind.value = kind
  portDialogValue.value = kind === 'http' ? httpPort.value : httpsPort.value
  portDialogVisible.value = true
}

function closePortDialog() {
  if (saving.value) return
  portDialogVisible.value = false
}

async function confirmPort() {
  if (portDialogValue.value == null) return
  await savePort(portDialogKind.value, portDialogValue.value)
  portDialogVisible.value = false
}

onActivated(() => { loadIps() })
</script>
<style lang="scss" scoped>
.scroll-content {
  padding: 0 0 16px 0;
}

.grids {
  display: grid;
  gap: 16px;
  padding: 16px;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
}

.card {
  height: 100%;
  margin-bottom: 12px;
}

.running-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #4caf50;
  margin-right: 6px;
  vertical-align: middle;
}

.address-row {
  font-family: monospace;
  font-size: 0.875rem;
  word-break: break-all;
}

.port-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

</style>
