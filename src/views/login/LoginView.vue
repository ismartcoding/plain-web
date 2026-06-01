<template>
  <header class="header">
    <header-actions :logged-in="false" />
  </header>
  <h1>PlainApp</h1>
  <div class="login-block">
    <LoginForm ref="loginFormRef" />
  </div>
</template>
<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import LoginForm from './LoginForm.vue'
import { setPendingLoginHost } from '@/lib/api/api'

const loginFormRef = ref<InstanceType<typeof LoginForm> | null>(null)

onMounted(() => {
  setPendingLoginHost(window.location.host)
  initializeLoginForm().catch(() => {})
})

async function initializeLoginForm() {
  await nextTick()
  if (!loginFormRef.value) {
    throw new Error('login_form_not_ready')
  }
  await loginFormRef.value.init()
}
</script>


<style lang="scss" scoped>
.header {
  display: flex;
  justify-content: end;
  margin-top: 6px;
}

h1 {
  margin-top: 100px;
  text-align: center;
}

.login-block {
  width: 320px;
  margin: 0 auto;
  --outlined-field-bg: var(--md-sys-color-surface-variant);
  background-color: var(--md-sys-color-surface-variant);
  border-radius: var(--pl-shape-xl);
  padding-block: var(--pl-spacing-xl);
  padding: 40px;
}
</style>
