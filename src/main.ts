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
import { setHttpProxyPort, setLocalServerPort, setLocalServerToken, setLocalServerHttpsPort } from './lib/api/api'

const clientId = localStorage.getItem('client_id')
if (!clientId) {
  localStorage.setItem('client_id', shortUUID())
}

if (!__IS_TAURI__) {
  import('./registerServiceWorker')
}

async function bootstrap() {
  // In Tauri, fetch local server port and token before mounting so that the
  // very first GraphQL queries (fired in setup hooks) have the values ready.
  if (__IS_TAURI__) {
    document.documentElement.classList.add('tauri')
    const { invoke } = await import('@tauri-apps/api/core')
    await Promise.all([
      invoke<number>('http_proxy_port').then(setHttpProxyPort),
      invoke<number>('local_server_port').then(setLocalServerPort),
      invoke<number>('local_server_https_port').then(setLocalServerHttpsPort),
      invoke<string>('local_server_token').then(setLocalServerToken),
    ])
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
}

bootstrap()
