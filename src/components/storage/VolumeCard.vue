<template>
  <div
    class="volume-card" role="button" tabindex="0" :class="{ active }" @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')" @keydown.space.prevent="$emit('click')">
    <div class="row">
      <div class="content">
        <div class="title-row">
          <div class="left">
            <span class="icon" aria-hidden="true">
              <popper>
                <i-lucide:hard-drive />
                <template #content>
                  <pre class="view-raw">{{ data }}</pre>
                </template>
              </popper>
            </span>
            <span class="title">{{ title }}</span>
            <span v-if="driveType" class="chip">{{ driveType }}</span>
          </div>
          <slot name="actions" />
        </div>

        <div v-if="showProgress" class="progress">
          <div class="bar" :style="{ width: usedPercentClamped + '%' }" />
        </div>

        <div v-if="showProgress" class="stats-row">
          <span class="muted">
            <slot name="count">{{ count }}</slot>
          </span>
          <span class="percent" :class="percentClass">
            <slot name="percent">{{ Math.round(usedPercentClamped) }}%</slot>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  sub: { type: String, default: '' },
  driveType: { type: String, default: '' },
  usedPercent: { type: Number, default: 0 },
  percentClass: { type: String, default: '' },
  count: { type: String, default: '' },
  active: { type: Boolean, default: false },
  showProgress: { type: Boolean, default: true },
  data: { type: Object, default: () => ({}) },
})

defineEmits<{ (e: 'click'): void }>()

const usedPercentClamped = computed(() => {
  const pct = Number(props.usedPercent || 0)
  if (!Number.isFinite(pct)) return 0
  return Math.max(0, Math.min(100, pct))
})
</script>
