<template>
  <div class="chat-section">
    <a class="list-item" @click="openTab('/books')" style="display: none">
      <span class="key">{{ $t('page_title.books') }}</span>
    </a>
    <a class="list-item" @click="openTab('/notes')">
      <span class="key">{{ $t('page_title.notes') }}</span>
    </a>
    <a class="list-item" @click="openTab('/feeds')">
      <span class="key">{{ $t('page_title.feeds') }}</span>
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
