<template>
  <left-sidebar>
    <template #title>{{ $t('settings') }}</template>
    <template #body>
      <ul class="nav">
        <router-link v-for="item in navItems" :key="item.path" :to="item.path" class="nav-item" active-class="active">
          <component :is="item.icon" class="icon" />
          <span class="title">{{ $t(item.labelKey) }}</span>
        </router-link>
      </ul>
    </template>
  </left-sidebar>
</template>

<script setup lang="ts">
import ILucidePalette from '~icons/lucide/palette'

const navItems = [
  { path: '/settings', icon: ILucidePalette, labelKey: 'common' },
]
</script>

<style lang="scss" scoped>
.nav {
  list-style: none;
  padding: 8px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--md-sys-color-on-surface-variant);
  text-decoration: none;
  font-size: 0.9375rem;
  cursor: pointer;

  .icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  &.active,
  &:hover {
    background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
    color: var(--md-sys-color-primary);
  }
}
</style>
