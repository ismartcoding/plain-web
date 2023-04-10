import type { Directive, Plugin } from 'vue'

const DOWN_ID = '__vue_click_away_down__'
const UP_ID = '__vue_click_away_up__'

const onMounted = (el: any, binding: any, vnode: any) => {
  onUnmounted(el)
  let downTarget: EventTarget | null

  const vm = vnode.context
  const callback = binding.value
  el[DOWN_ID] = (event: PointerEvent) => {
    downTarget = event.target
  }

  el[UP_ID] = (event: PointerEvent) => {
    if (downTarget !== event.target) {
      return
    }

    if ((!el || !el.contains(event.target)) && callback && typeof callback === 'function') {
      return callback.call(vm, event)
    }
  }

  document.addEventListener('mousedown', el[DOWN_ID], false)
  document.addEventListener('mouseup', el[UP_ID], false)
}

const onUnmounted = (el: { [x: string]: any }) => {
  document.removeEventListener('mousedown', el[DOWN_ID], false)
  document.removeEventListener('mouseup', el[UP_ID], false)
  delete el[DOWN_ID]
  delete el[UP_ID]
}

const onUpdated = (el: any, binding: { value: any; oldValue: any }, vnode: any) => {
  if (binding.value === binding.oldValue) {
    return
  }
  onMounted(el, binding, vnode)
}

const plugin: Plugin = {
  install: (app) => {
    app.directive('click-away', directive)
  },
}

const directive: Directive = {
  mounted: onMounted,
  updated: onUpdated,
  unmounted: onUnmounted,
}

export default plugin
