<template>
  <div class="chat-section">
    <a class="list-item" @click="openTab('/images')">
      <span class="key">{{ $t('page_title.images') }}</span>
    </a>
    <a class="list-item" @click="openTab('/videos')">
      <span class="key">{{ $t('page_title.videos') }}</span>
    </a>
    <a class="list-item" @click="openTab('/audios')">
      <span class="key">{{ $t('page_title.audios') }}</span>
    </a>
    <a class="list-item" @click="openTab('/files')">
      <span class="key">{{ $t('page_title.files') }}</span>
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
