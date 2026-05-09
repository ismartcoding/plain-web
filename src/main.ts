import { createApp } from 'vue'
import App from './App.vue'
import router from './plugins/router'
import '@/styles/main.scss'
import 'katex/dist/katex.min.css'
import { createPinia } from 'pinia'
import VueClickAway from './plugins/clickaway'
import VueTooltip from './plugins/tooltip'
import VueRipple from './plugins/ripple'
import i18n from './plugins/i18n'
import { shortUUID } from './lib/strutil'
import { getIsPhone, getIsTablet } from './hooks/device'
import { setHttpProxyPort } from './lib/api/api'

const clientId = localStorage.getItem('client_id')
if (!clientId) {
  localStorage.setItem('client_id', shortUUID())
}

if (!__IS_TAURI__) {
  import('./registerServiceWorker')
}

// Initialise the local HTTP reverse proxy port used by file uploads in Tauri.
// Dynamic import keeps @tauri-apps/api out of the web bundle entirely.
if (__IS_TAURI__) {
  document.documentElement.classList.add('tauri')
  import('@tauri-apps/api/core').then(({ invoke }) =>
    invoke<number>('http_proxy_port').then(setHttpProxyPort),
  )
}

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
