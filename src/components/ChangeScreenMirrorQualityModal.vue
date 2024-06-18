<template>
  <md-dialog>
    <div slot="headline">
      {{ $t('change_quality') }}
    </div>
    <div slot="content">
      <div class="form-row">
        <md-outlined-segmented-button-set @segmented-button-set-selection="onOptionSelected">
          <md-outlined-segmented-button v-for="item in options" :key="item.id" :data-value="item.id" :label="$t(item.id)" :selected="qualityId === item.id" />
        </md-outlined-segmented-button-set>
      </div>
      <div class="form-row">
        <label class="form-label">
          {{ $t('compress_quality') }}
        </label>
        <md-outlined-select class="flex-2" menu-positioning="fixed" v-model.number="quality" :disabled="qualityId !== 'custom'">
          <md-select-option v-for="o of qualityOptions" :key="o" :value="o">
            <div slot="headline">{{ getCompressOptionText(o) }}</div>
          </md-select-option>
        </md-outlined-select>
      </div>
      <div class="form-row">
        <label class="form-label">
          {{ $t('resolution') }}
        </label>
        <md-outlined-select class="flex-2" menu-positioning="fixed" v-model.number="resolution" :disabled="qualityId !== 'custom'">
          <md-select-option v-for="o of resolutionOptions" :key="o" :value="o">
            <div slot="headline">{{ o }}p</div>
          </md-select-option>
        </md-outlined-select>
      </div>
      <div class="form-row">
        {{ $t('screen_mirror_quality_tips') }}
      </div>
    </div>
    <div slot="actions">
      <md-outlined-button value="cancel" @click="popModal">{{ $t('cancel') }}</md-outlined-button>
      <md-filled-button value="save" :disabled="saving" @click="doAction" autofocus>
        <md-circular-progress indeterminate v-if="saving" slot="icon" /> {{ $t('save') }}
      </md-filled-button>
    </div>
  </md-dialog>
</template>
<script setup lang="ts">
import { updateScreenMirrorQualityGQL, initMutation } from '@/lib/api/mutation'
import type { IScreenMirrorQuality, IScreenMirrorQualityOption } from '@/lib/interfaces'
import { ref } from 'vue'
import { popModal } from './modal'
import type { MdOutlinedSegmentedButton } from '@material/web/labs/segmentedbutton/outlined-segmented-button'
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
  appApi: true,
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

function onOptionSelected(
  e: CustomEvent<{
    button: MdOutlinedSegmentedButton
    selected: boolean
    index: number
  }>
) {
  const { button } = e.detail
  const value = button.dataset.value as string
  qualityId.value = value
  const option = options.find((it) => it.id === value)
  if (option && option.data) {
    resolution.value = option.data.resolution
    quality.value = option.data.quality
  }
}

const {
  mutate: updateScreenMirrorQuality,
  loading: saving,
  onDone: onDone,
} = initMutation({
  document: updateScreenMirrorQualityGQL,
  appApi: true,
})

onDone(() => {
  popModal()
})

const doAction = () => {
  updateScreenMirrorQuality({ resolution: resolution.value, quality: quality.value })
}
</script>
<style lang="scss" scoped>
md-outlined-select {
  min-width: 120px;
}
md-dialog {
  min-width: 540px;
}
</style>
