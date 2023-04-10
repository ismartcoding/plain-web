<template>
  <div class="chat-section">
    <a class="list-item" @click="openTab('/network')">
      <span class="key">{{ $t('page_title.network') }}</span>
    </a>
    <a class="list-item" @click="openTab('/wifi')">
      <span class="key">{{ $t('page_title.wifi') }}</span>
    </a>
    <a class="list-item" @click="openTab('/wireguard')">
      <span class="key">{{ $t('page_title.wireguard') }}</span>
    </a>
    <a class="list-item" @click="openTab('/rules')">
      <span class="key">{{ $t('page_title.rules') }}</span>
    </a>
    <a class="list-item" @click="openTab('/routes')">
      <span class="key">{{ $t('page_title.routes') }}</span>
    </a>
    <a class="list-item" @click="openTab('/devices')">
      <span class="key">{{ $t('page_title.devices') }}</span>
    </a>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function openTab(fullPath: string) {
  router.push(fullPath)
}
</script>

<style lang="scss" scoped></style>
