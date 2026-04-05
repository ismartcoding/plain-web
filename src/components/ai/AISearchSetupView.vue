<template>
  <div>
    <p class="setup-desc">{{ $t('ai.engine_subtitle') }}</p>

    <template v-if="uploading">
      <progress-card :label-html="uploadStatus" :value="uploadProgress" />
      <v-outlined-button class="btn-block setup-cancel" @click="cancelUpload">
        {{ $t('ai.cancel_upload') }}
      </v-outlined-button>
    </template>

    <template v-else>
      <p class="setup-hint">{{ $t('ai.setup_hint', { size: formatSize(status.modelSize) }) }}</p>

      <div v-if="status.errorMessage" class="setup-error">{{ status.errorMessage }}</div>

      <v-filled-button class="btn-block" :loading="enableLoading" @click="enable">
        {{ $t('ai.activate_download') }}
      </v-filled-button>

      <div class="setup-divider"><span>{{ $t('or') }}</span></div>

      <v-outlined-button class="btn-block" :disabled="enableLoading" @click="fileInput?.click()">
        {{ $t('ai.manual_upload') }}
      </v-outlined-button>

      <p class="setup-source" v-html="modelSourceHtml" />
    </template>

    <input ref="fileInput" style="display: none" type="file" multiple accept=".tflite,.json" @change="onFileChange" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { IImageSearchStatus } from '@/lib/interfaces'
import { useAIModelUpload } from '@/hooks/ai-model-upload'
import { useImageSearchActions } from '@/hooks/ai/use-image-search-actions'

const MODEL_URL = 'https://huggingface.co/plainhub/mobileclip-s2-tflite/tree/main'

const props = defineProps<{ status: IImageSearchStatus }>()
const { t } = useI18n()

const fileInput = ref<HTMLInputElement | null>(null)
const { uploading, uploadStatus, uploadProgress, uploadDone, startUpload, cancelUpload } = useAIModelUpload()
const { enable, enableLoading } = useImageSearchActions()

watch(uploadDone, (done) => {
  if (done) {
    uploadDone.value = false
    enable()
  }
}, { immediate: true })

const modelSourceHtml = computed(() => {
  const link = `<a href="${MODEL_URL}" target="_blank" rel="noopener">${t('ai.model_source_link')}</a>`
  return t('ai.model_source_hint', { link })
})

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB'
  return Math.round(bytes / 1e3) + ' KB'
}

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files && files.length > 0) {
    startUpload(files, props.status.modelDir)
    ;(e.target as HTMLInputElement).value = ''
  }
}
</script>

<style lang="scss" scoped>
.setup-desc {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0 0 20px;
}
.setup-cancel {
  margin-top: 12px;
}
.setup-error {
  color: var(--md-sys-color-error);
  font-size: 0.8rem;
  margin-bottom: 12px;
}
.setup-hint {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 0.8rem;
  line-height: 1.5;
  margin: 0 0 20px;
}
.setup-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--md-sys-color-outline-variant);
  }
  span { font-size: 0.8rem; color: var(--md-sys-color-on-surface-variant); }
}
.setup-source {
  text-align: center;
  font-size: 0.8rem;
  color: var(--md-sys-color-on-surface-variant);
  margin: 20px 0 0;
  :deep(a) {
    color: var(--md-sys-color-primary);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
}
.setup-label {
  font-size: 0.8rem;
  color: var(--md-sys-color-on-surface);
  margin: 0 0 8px;
}
.setup-pct {
  text-align: right;
  font-size: 0.8rem;
  color: var(--md-sys-color-on-surface-variant);
  margin: 4px 0 0;
}
</style>
