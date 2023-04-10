import { h, render } from 'vue'
import type { MenuOptions } from './ContextMenuDefine'
import ContextMenuConstructor from './ContextMenu.vue'

export const contextmenu = (options: MenuOptions) => {
  const container = document.createElement('div')
  const vnode = h(ContextMenuConstructor, {
    options: options,
    show: true,
    onClose: () => {
      render(null, container)
    },
  })
  render(vnode, container)
  document.body.appendChild(container.firstElementChild as Node)
  return vnode.component
}
