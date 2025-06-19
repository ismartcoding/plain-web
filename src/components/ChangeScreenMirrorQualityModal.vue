<template>
  <v-modal modal-id="screen-mirror-quality" @close="popModal">
    <template #headline>
      {{ $t('change_quality') }}
    </template>
    <template #content>
      <div class="form-row">
        <div class="button-group"> 
          <button v-for="item in options" :key="item.id" :class="{ 'selected': qualityId === item.id }" @click="onOptionSelected(item)">
            {{ $t(item.id) }}
          </button>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">
          {{ $t('compress_quality') }}
        </label>
        <v-select 
          v-model.number="quality" 
          class="flex-2" 
          :disabled="qualityId !== 'custom'"
          :options="qualityOptions.map(o => ({ value: o, label: getCompressOptionText(o) }))"
        />
      </div>
      <div class="form-row">
        <label class="form-label">
          {{ $t('resolution') }}
        </label>
        <v-select 
          v-model.number="resolution" 
          class="flex-2" 
          :disabled="qualityId !== 'custom'"
          :options="resolutionOptions.map(o => ({ value: o, label: `${o}p` }))"
        />
      </div>
      <div class="form-row" style="max-width: 640px;">
        {{ $t('screen_mirror_quality_tips') }}
      </div>
    </template>
    <template #actions>
      <v-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</v-outlined-button>
      <v-filled-button value="save" :loading="saving" @click="doAction">
        {{ $t('save') }}
      </v-filled-button>
    </template>
  </v-modal>
</template>
<script setup lang="ts">
import { updateScreenMirrorQualityGQL, initMutation } from '@/lib/api/mutation'
import type { IScreenMirrorQuality, IScreenMirrorQualityOption } from '@/lib/interfaces'
import { ref } from 'vue'
import { popModal } from './modal'
import { screenMirrorQualityGQL, initQuery } from '@/lib/api/query'
import toast from '@/components/toaster'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const resolution = ref(720) // 480P, 720P, 1080P
const quality = ref(60) // 60, 70, 80
const qualityId = ref('quality_sd')
const options: IScreenMirrorQualityOption[] = [
  { id: 'quality_ld', data: { resolution: 480, quality: 50 } },
  { id: 'quality_sd', data: { resolution: 720, quality: 50 } },
  { id: 'quality_hd', data: { resolution: 1080, quality: 50 } },
  { id: 'custom' },
]
const qualityOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
const resolutionOptions = [480, 720, 1080]

initQuery({
  handle: (data: { screenMirrorQuality: IScreenMirrorQuality }, error: string) => {
    if (error) {
      toast(t(error), 'error')
    } else {
      if (data) {
        resolution.value = data.screenMirrorQuality.resolution
        quality.value = data.screenMirrorQuality.quality
        qualityId.value = options.find((it) => it.data?.resolution === resolution.value && it.data?.quality === quality.value)?.id || 'custom'
      }
    }
  },
  document: screenMirrorQualityGQL,
})

function getCompressOptionText(value: number) {
  if (value === 10) {
    return `10 (${t('low_quality')})`
  } else if (value === 60) {
    return `60 (${t('high_quality')})`
  } else if (value === 100) {
    return `100 (${t('best_quality')})`
  }
  return value.toString()
}

function onOptionSelected(item: IScreenMirrorQualityOption) {
  qualityId.value = item.id
  if (item.data) {
    resolution.value = item.data.resolution
    quality.value = item.data.quality
  }
}

const {
  mutate: updateScreenMirrorQuality,
  loading: saving,
  onDone: onDone,
} = initMutation({
  document: updateScreenMirrorQualityGQL,
})

onDone(() => {
  popModal()
})

const doAction = () => {
  updateScreenMirrorQuality({ resolution: resolution.value, quality: quality.value })
}
</script>
