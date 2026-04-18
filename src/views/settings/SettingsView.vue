<template>
  <div class="scroll-content">
    <div class="top-app-bar">
      <div class="title">{{ $t('settings') }}</div>
    </div>
    <div class="settings-body">
      <router-view />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-body {
  padding: 16px;
}
</style>
