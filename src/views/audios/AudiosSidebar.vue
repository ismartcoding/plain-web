<template>
  <media-sidebar :type="DataType.AUDIO" :gql="audioCountGQL" />
</template>
<script setup lang="ts">
import { DataType } from '@/lib/data'
import { audioCountGQL } from '@/lib/api/query'
</script>
