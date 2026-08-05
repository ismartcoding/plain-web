<template>
  <v-dropdown v-model="menuVisible">
    <template #trigger>
      <button v-tooltip="$t('image_quality')" type="button" class="btn-icon quality-trigger" @click.stop="menuVisible = !menuVisible">
        {{ modelValue === 'original' ? $t('image_quality_original') : $t('image_quality_fast') }}
      </button>
    </template>
    <div class="dropdown-item" @click="select('fast')">
      <i-material-symbols:check-rounded v-if="modelValue === 'fast'" /><span v-else class="check-placeholder" />{{ $t('image_quality_fast') }}
    </div>
    <div class="dropdown-item" @click="select('original')">
      <i-material-symbols:check-rounded v-if="modelValue === 'original'" /><span v-else class="check-placeholder" />{{ $t('image_quality_original') }}
    </div>
  </v-dropdown>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  modelValue: 'fast' | 'original'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: 'fast' | 'original']
}>()

const menuVisible = ref(false)

function select(value: 'fast' | 'original') {
  emit('update:modelValue', value)
  menuVisible.value = false
}
</script>

<style scoped lang="scss">
.quality-trigger {
  width: auto;
  flex: 0 0 auto;
  height: 40px;
  padding: 0 12px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
}

.check-placeholder {
  width: 24px;
  flex-shrink: 0;
}
</style>
