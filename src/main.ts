import { createApp } from 'vue'
import App from './App.vue'
import router from './plugins/router'
import '@/styles/main.scss'
import 'katex/dist/katex.min.css'
import { createPinia } from 'pinia'
import VueClickAway from './plugins/clickaway'
import VueTooltip from './plugins/tooltip'
import VueRipple from './plugins/ripple'
import { shortUUID } from './lib/strutil'
import { getIsPhone, getIsTablet } from './hooks/device'
import { setHttpProxyPort, setLocalServerPort, setLocalServerToken, setLocalServerHttpsPort } from './lib/api/api'
import { preload as preloadPrefs, get as prefsGet, set as prefsSet } from './lib/prefs'

if (!__IS_TAURI__) {
  import('./registerServiceWorker')
  // Web mode: ensure client_id exists in localStorage on startup
  if (!prefsGet('client_id', '')) {
    prefsSet('client_id', shortUUID())
  }
}

async function bootstrap() {
  if (__IS_TAURI__) {
    document.documentElement.classList.add('tauri')
    // Load all prefs from plugin-store into memory FIRST so synchronous
    // readers (i18n, stores) see the persisted values without hitting localStorage.
    await preloadPrefs()
    // Ensure client_id exists in prefs for Tauri mode.
    if (!prefsGet('client_id', '')) {
      prefsSet('client_id', shortUUID())
    }
    const { invoke } = await import('@tauri-apps/api/core')
    await Promise.all([
      invoke<number>('http_proxy_port').then(setHttpProxyPort),
      invoke<number>('local_server_port').then(setLocalServerPort),
      invoke<number>('local_server_https_port').then(setLocalServerHttpsPort),
      invoke<string>('local_server_token').then(setLocalServerToken),
    ])
  }

  // Dynamically import i18n AFTER prefs are loaded so createI18n() reads
  // the persisted locale from the prefs cache instead of localStorage.
  const { default: i18n } = await import('./plugins/i18n')

  createApp(App)
    .use(VueClickAway)
    .use(VueTooltip)
    .use(VueRipple)
    .use(createPinia())
    .use(router)
    .use(i18n)
    .provide('isPhone', getIsPhone())
    .provide('isTablet', getIsTablet())
    .mount('#app')
}

bootstrap()
