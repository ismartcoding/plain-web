import { createApp, provide, h } from 'vue'
import { ApolloClients } from '@vue/apollo-composable'
import App from './App.vue'
import router from './plugins/router'
import '@/styles/bs/bootstrap.scss'
import '@/styles/main.scss'
import { createPinia } from 'pinia'
import apollo from './plugins/apollo'
import VueClickAway from './plugins/clickaway'
import i18n from './plugins/i18n'
import { shortUUID } from './lib/strutil'
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
  .use(createPinia())
  .use(router)
  .use(i18n)
  .mount('#app')
