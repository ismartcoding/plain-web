<template>
  <media-sidebar :type="DataType.DOC" :gql="docCountGQL" />
</template>
<script setup lang="ts">
import { DataType } from '@/lib/data'
import { docCountGQL } from '@/lib/api/query'
</script>
