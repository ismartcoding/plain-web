<template>
  <div class="page-container">
    <div class="main">
      <div class="v-toolbar">
        <breadcrumb :current="() => $t('device_info')" />
      </div>
      <div class="panel-container">
        <div v-if="loading" class="loading">
          <md-circular-progress indeterminate />
        </div>
        <div class="grid text-center">
  <div class="g-col-4">.g-col-4</div>
  <div class="g-col-4">.g-col-4</div>
  <div class="g-col-4">.g-col-4</div>
</div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import toast from '@/components/toaster'
import { initQuery, deviceInfoGQL } from '@/lib/api/query'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { loading, refetch } = initQuery({
  handle: (data: any, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
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
</style>
