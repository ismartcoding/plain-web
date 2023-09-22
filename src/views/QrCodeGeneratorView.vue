<template>
  <div class="page-container">
    <div class="main">
      <div class="v-toolbar">
        <breadcrumb :current="() => $t('qrcode_generator')" />
      </div>
      <splitpanes class="panel-container">
        <pane>
          <md-outlined-text-field type="textarea" rows="3" v-model="qrCode" />
        </pane>
        <pane class="qrcode-panel">
          <img v-if="url" :src="url" />
        </pane>
      </splitpanes>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Splitpanes, Pane } from 'splitpanes'
import { ref, watch } from 'vue'
import { Encoder, ErrorCorrectionLevel } from '@nuintun/qrcode'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'

const { qrCode } = storeToRefs(useMainStore())
const url = ref('')

const updateUrl = () => {
  try {
    const qrcode = new Encoder()
    qrcode.setEncodingHint(true)
    qrcode.setErrorCorrectionLevel(ErrorCorrectionLevel.H)
    qrcode.write(qrCode.value)
    qrcode.make()
    url.value = qrcode.toDataURL(8)
  } catch (ex) {
    console.error(ex)
  }
}
watch(qrCode, () => {
  updateUrl()
})
updateUrl()
</script>
<style lang="scss" scoped>
img {
  width: 50%;
  min-width: 200px;
  max-width: 400px;
  aspect-ratio: 1 / 1;
  margin: 40px auto 0 auto;
  display: block;
}

md-outlined-text-field {
  width: 100%;
  height: 100%;
}
.page-container .splitpanes {
  height: calc(100vh - 186px);
}
</style>
