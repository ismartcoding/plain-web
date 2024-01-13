export const voidFn = () => {
  return
}

// TODO: prepare for mobile touch event
export let supportsPassive = false

try {
  const options = {}
  Object.defineProperty(options, 'passive', {
    get() {
      supportsPassive = true
    },
  })
  window.addEventListener('test-passive', voidFn, options)
} catch (e) {
  voidFn()
}

export const on = (target: Element | Document | Window, event: string, handler: EventListenerOrEventListenerObject, passive = false) => {
  target.addEventListener(event, handler, supportsPassive ? { capture: false, passive } : false)
}

export const off = (target: Element | Document | Window, event: string, handler: EventListenerOrEventListenerObject) => {
  target.removeEventListener(event, handler)
}

export const preventDefault = (e: Event) => {
  e.preventDefault()
}

const toString = Object.prototype.toString
const isType = (type: string) => (arg: unknown) => toString.call(arg).slice(8, -1) === type

export function isArray(arg: unknown): arg is unknown[] {
  return isType('Array')(arg)
}
