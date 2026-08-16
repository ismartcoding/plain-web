<template>
  <div class="about">
    <div class="about-card">
      <div class="logo-wrap">
        <div class="logo-glow" />
        <img class="logo" src="/logo.svg" alt="PlainApp" draggable="false" />
      </div>

      <p class="version">Version {{ version }}</p>

      <transition name="fade">
        <div v-if="status" class="status" :class="statusClass">
          <template v-if="status === 'loading'">
            <span class="spinner" /> Checking…
          </template>
          <template v-else-if="status === 'success' && hasUpdate()">
            <span class="ok">🎉</span> v{{ result!.latestVersion }} is available
            <button class="link" @click="goToRelease">View Release</button>
          </template>
          <template v-else-if="status === 'success'">
            <span class="ok">✓</span> You're up to date
          </template>
          <template v-else-if="status === 'error'">
            <span class="err">!</span> {{ error }}
          </template>
        </div>
      </transition>
    </div>

    <p class="copyright">© {{ new Date().getFullYear() }} PlainApp</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@/lib/browser'

interface UpdateCheck {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseName: string
  releaseUrl: string
  publishedAt: string
}

const version = ref('')
const status = ref<'loading' | 'success' | 'error' | ''>('')
const result = ref<UpdateCheck | null>(null)
const error = ref('')

const hasUpdate = () => result.value?.hasUpdate ?? false

const statusClass = () => {
  if (status.value === 'success') return result.value?.hasUpdate ? 'is-update' : 'is-ok'
  if (status.value === 'error') return 'is-error'
  return ''
}

async function runCheck() {
  status.value = 'loading'
  error.value = ''
  try {
    result.value = await invoke<UpdateCheck>('check_for_updates', {})
    status.value = 'success'
  } catch (e) {
    status.value = 'error'
    error.value = String(e)
  }
}

function goToRelease() {
  if (result.value?.releaseUrl) openUrl(result.value.releaseUrl)
}

onMounted(async () => {
  try {
    const info = await invoke<{ version: string; name: string }>('get_app_info', {})
    version.value = info.version
  } catch {
    version.value = '0.1.0'
  }
  runCheck()
})
</script>

<style scoped>
.about {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 24px;
  box-sizing: border-box;
  background: var(--md-sys-color-background);
  color: var(--md-sys-color-on-surface);
  overflow: hidden;
}

.about-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 320px;
}

.logo-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 16px;
}

.logo-glow {
  position: absolute;
  inset: 0;
  border-radius: 32px;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--md-sys-color-primary) 38%, transparent),
    transparent 70%
  );
  filter: blur(14px);
  animation: breathe 3s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.96);
  }
  50% {
    opacity: 1;
    transform: scale(1.04);
  }
}

.logo {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 28px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}

.version {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 12px;
  min-height: 38px;
  box-sizing: border-box;
}

.status.is-ok {
  color: var(--md-sys-color-on-surface);
  background: var(--md-sys-color-surface-container-high);
}

.status.is-update {
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
}

.status.is-error {
  color: var(--md-sys-color-error);
  background: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);
}

.ok {
  font-weight: 700;
}

.err {
  font-weight: 700;
}

.link {
  margin-left: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-primary);
  background: var(--md-sys-color-primary);
  cursor: pointer;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--md-sys-color-on-primary) 55%, transparent);
  border-top-color: var(--md-sys-color-on-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.copyright {
  margin: 0;
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
}
</style>