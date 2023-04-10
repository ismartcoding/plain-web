import Toaster from './Toaster.vue'
import { render, h } from 'vue'

export default (message: string, type = '') => {
  render(h(Toaster, { message, type }), document.createElement('div'))
}
