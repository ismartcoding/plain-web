<template>
  <media-sidebar :type="DataType.IMAGE" :gql="imageCountGQL" />
</template>
<script setup lang="ts">
import { DataType } from '@/lib/data'
import { imageCountGQL } from '@/lib/api/query'
</script>
