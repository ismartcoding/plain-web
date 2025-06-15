<template>
  <keyboard-shortcuts :shortcuts="shortcuts" />
</template>

<script setup lang="ts">
const shortcuts = [
  { keys: ['Delete'], description: 'delete_selected' },
  { keys: ['modifier', '+', 'Backspace'], description: 'delete_selected' },
  { keys: ['modifier', '+', 'A'], description: 'select_all' },
  { keys: ['Esc'], description: 'clear_selection' },
  // { keys: ['modifier', '+', 'C'], description: 'copy' },
  // { keys: ['modifier', '+', 'X'], description: 'cut' },
  // { keys: ['modifier', '+', 'V'], description: 'paste' },
  { keys: ['Shift', '+', 'Click'], description: 'range_select' }
]
</script> 