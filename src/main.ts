import { createApp, provide, h } from 'vue'
import { ApolloClients } from '@vue/apollo-composable'
import App from './App.vue'
import './registerServiceWorker'
import router from './plugins/router'
import '@/styles/main.scss'
import { createPinia } from 'pinia'
import apollo from './plugins/apollo'
import VueClickAway from './plugins/clickaway'
import VueTooltip from './plugins/tooltip'
import VueRipple from './plugins/ripple'
import i18n from './plugins/i18n'
import { shortUUID } from './lib/strutil'
import { getIsPhone } from './hooks/device'

const clientId = localStorage.getItem('client_id')
if (!clientId) {
  localStorage.setItem('client_id', shortUUID())
}


createApp({
  setup() {
    provide(ApolloClients, apollo)
  },
  render: () => h(App),
})
  .use(VueClickAway)
  .use(VueTooltip)
  .use(VueRipple)
  .use(createPinia())
  .use(router)
  .use(i18n)
  .provide('isPhone', getIsPhone())
  .mount('#app')
