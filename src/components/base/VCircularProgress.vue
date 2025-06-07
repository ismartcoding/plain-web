<template>
  <div 
    class="v-circular-progress" 
    :class="{ 
      'indeterminate': indeterminate,
      'determinate': !indeterminate 
    }"
  >
    <svg class="circular" :width="size" :height="size" viewBox="0 0 50 50">
      <circle
        class="path"
        cx="24"
        cy="24"
        :r="20"
        fill="none"
        :stroke-width="4"
        stroke-linecap="round"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
interface Props {
  indeterminate?: boolean
  progress?: number
  size?: number
  strokeWidth?: number
}

withDefaults(defineProps<Props>(), {
  indeterminate: false,
  progress: 0,
  size: 32,
  strokeWidth: 4
})
</script>

<style scoped lang="scss">
.v-circular-progress {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--size, 32px);
  height: var(--size, 32px);
  color: var(--md-sys-color-primary, #6750a4);
  
  .circular {
    width: var(--size, 32px);
    height: var(--size, 32px);
  }
  
  .path {
    stroke: currentColor;
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
  }
  
  &.indeterminate {
    .circular {
      animation: rotate 2s linear infinite;
    }
    
    .path {
      animation: 
        dash 1.5s ease-in-out infinite;
    }
  }
  
  &.determinate {
    .circular {
      transform: rotate(-90deg);
    }
    
    .path {
      stroke-dasharray: var(--circumference);
      stroke-dashoffset: calc(var(--circumference) - (var(--progress) / 100 * var(--circumference)));
      transition: stroke-dashoffset 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  &.sm {
    --size: 24px;
  }

  &.primary {
    color: var(--md-sys-color-primary, #6750a4);
  }

  &.secondary {
    color: var(--md-sys-color-secondary, #625b71);
  }

  &.error {
    color: var(--md-sys-color-error, #ba1a1a);
  }

  &.success {
    color: var(--md-sys-color-tertiary, #7d5260);
  }
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 89, 200;
    stroke-dashoffset: -35px;
  }
  100% {
    stroke-dasharray: 89, 200;
    stroke-dashoffset: -124px;
  }
}
</style> 