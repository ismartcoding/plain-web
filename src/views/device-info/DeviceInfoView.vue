<template>
  <Teleport v-if="isActive" to="#header-end-slot" defer>
    <v-icon-button v-tooltip="$t('refresh')" :loading="loading" @click="refetch">
      <i-material-symbols:refresh-rounded />
    </v-icon-button>
  </Teleport>
  <div class="scroll-content">
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
import { ref, onActivated, onDeactivated } from 'vue'
import { formatDateTime, formatDateTimeFull } from '@/lib/format'
import { useDeviceInfo } from './device-info'

const isActive = ref(false)
onActivated(() => { isActive.value = true })
onDeactivated(() => { isActive.value = false })

const { basicInfos, systemInfos, batteryInfos, loading, refetch } = useDeviceInfo()
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
    padding: 12px;
  }

  .scroll-content {
    padding: 0 0 12px 0;
  }
}

</style>
