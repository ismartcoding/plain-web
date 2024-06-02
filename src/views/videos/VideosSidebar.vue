<template>
  <media-sidebar :type="DataType.VIDEO" :gql="videoCountGQL" />
</template>
<script setup lang="ts">
import { DataType } from '@/lib/data'
import { videoCountGQL } from '@/lib/api/query'
</script>
