<template>
  <div class="scroll-content">
    <div class="top-app-bar">
      <div class="title">
        {{ $t('qrcode_generator') }}
      </div>
    </div>
    <div class="qrcode-container">
      <v-text-field v-model="qrCode" class="qrcode-textarea" type="textarea" :rows="3" />
      <div class="qrcode-panel">
        <img v-if="url" :src="url" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Encoder, ErrorCorrectionLevel } from '@nuintun/qrcode'
import { useMainStore } from '@/stores/main'
import { storeToRefs } from 'pinia'
import toast from '@/components/toaster'

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
    toast(ex as string, 'error')
    console.error(ex)
  }
}
watch(qrCode, () => {
  updateUrl()
})
updateUrl()
</script>
<style lang="scss" scoped>
.qrcode-container {
  display: grid;
  grid-template-columns: 50% 50%;
  margin-inline: 16px;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    margin-inline: 12px;
  }
}

img {
  width: 50%;
  min-width: 200px;
  max-width: 400px;
  aspect-ratio: 1 / 1;
  margin: 40px auto 0 auto;
  display: block;
  
  @media (max-width: 480px) {
    width: 70%;
    min-width: 150px;
    max-width: 250px;
    margin: 20px auto;
  }
}

:deep(.qrcode-textarea) {
  height: calc(100vh - 180px) !important;
  
  @media (max-width: 480px) {
    height: 200px !important;
  }
}
</style>
