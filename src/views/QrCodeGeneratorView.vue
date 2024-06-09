<template>
  <div class="top-app-bar">
    <div class="title">
      {{ $t('qrcode_generator') }}
    </div>
  </div>
  <div class="scroll-content">
    <md-outlined-text-field v-model="qrCode" class="textarea" type="textarea" rows="3" />
    <div class="qrcode-panel">
      <img v-if="url" :src="url" />
    </div>
  </div>
</template>

<script setup lang="ts">
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
.scroll-content {
  display: grid;
  grid-template-columns: 50% 50%;

  .textarea {
    height: calc(100vh - 132px);
  }
}

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
</style>
