<template>
  <section
    class="list-item-phone selectable-card"
    :class="{ selected: isSelected, selecting: isSelecting }"
    @click.stop="$emit('click', $event)"
    @mouseover="$emit('mouseover', $event)"
  >
    <div class="phone-left">
      <v-checkbox 
        touch-target="wrapper" 
        :checked="checkboxChecked" 
        @click.stop="$emit('checkboxClick', $event)" 
      />
      <slot name="image" />
    </div>
    
    <div class="phone-content">
      <div class="title">
        <slot name="title" />
      </div>
      
      <div class="subtitle-container">
        <slot name="subtitle" />
      </div>
      
      <slot name="actions" />
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  isSelected?: boolean
  isSelecting?: boolean
  checkboxChecked?: boolean
}

withDefaults(defineProps<Props>(), {
  isSelected: false,
  isSelecting: false,
  checkboxChecked: false
})

defineEmits<{
  click: [event: MouseEvent]
  mouseover: [event: MouseEvent]
  checkboxClick: [event: MouseEvent]
}>()
</script>