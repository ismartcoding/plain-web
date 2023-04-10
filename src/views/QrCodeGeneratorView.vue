<template>
  <div class="page-container container">
    <div class="main">
      <div class="v-toolbar">
        <breadcrumb :current="() => $t('qrcode_generator')" />
      </div>
      <splitpanes class="panel-container">
        <pane>
          <monaco-editor v-model="content" />
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

const content = ref('')
const url = ref('')

watch(content, (value: string) => {
  try {
    const qrcode = new Encoder()
    qrcode.setEncodingHint(true)
    qrcode.setErrorCorrectionLevel(ErrorCorrectionLevel.H)
    qrcode.write(value)
    qrcode.make()
    url.value = qrcode.toDataURL(8) //.replace('data:image/gif', 'data:image/png')
  } catch (ex) {}
})
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
</style>
