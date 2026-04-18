<template>
  <div class="settings-section">
    <h3 class="section-title">{{ $t('appearance') }}</h3>
    <div class="setting-row">
      <span class="setting-label">{{ $t('theme') }}</span>
      <theme-changer />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
  margin: 0 0 4px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.setting-label {
  font-size: 0.9375rem;
  color: var(--md-sys-color-on-surface-variant);
}
</style>
