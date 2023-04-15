<template>
  <div class="chat-section">
    <a class="list-item" @click="openTab('/messages')">
      <span class="key">{{ $t('page_title.messages') }}</span>
    </a>
    <a class="list-item" @click="openTab('/contacts')">
      <span class="key">{{ $t('page_title.contacts') }}</span>
    </a>
    <a class="list-item" @click="openTab('/calls')">
      <span class="key">{{ $t('page_title.calls') }}</span>
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
