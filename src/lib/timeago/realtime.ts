import { setTimerId, getTimerId, getDateAttribute } from './utils/dom'
import { diffSec, nextInterval } from './utils/date'
import { format } from './format'
import { getMessages } from './register'
import type { Opts, TimerPool } from './interface'

// all realtime timer
const TIMER_POOL: TimerPool = {}

/**
 * clear a timer from pool
 * @param tid
 */
const clear = (tid: number): void => {
  clearTimeout(tid)
  delete TIMER_POOL[tid]
}

// run with timer(setTimeout)
function run(node: HTMLElement, date: string, locale: string, opts: Opts): void {
  // clear the node's exist timer
  clear(getTimerId(node))

  const { relativeDate, minInterval } = opts

  // render
  const messages = getMessages(locale) ?? getMessages('en-US')
  if (!messages) return
  node.innerText = format(date, locale, messages, opts)

  const tid = setTimeout(
    () => {
      run(node, date, locale, opts)
    },
    Math.min(Math.max(nextInterval(diffSec(date, relativeDate)), minInterval || 1) * 1000, 0x7fffffff)
  ) as unknown as number

  // there is no need to save node in object. Just save the key
  TIMER_POOL[tid] = 0
  setTimerId(node, tid)
}

/**
 * cancel a timer or all timers
 * @param node - node hosting the time string
 */
export function cancel(node?: HTMLElement): void {
  // cancel one
  if (node) clear(getTimerId(node))
  // cancel all
  // @ts-ignore
  else Object.keys(TIMER_POOL).forEach(clear)
}

/**
 * render a dom realtime
 * @param nodes
 * @param locale
 * @param opts
 */
export function render(nodes: HTMLElement | HTMLElement[] | NodeList, locale?: string, opts?: Opts) {
  const lc = locale ?? ''
  // @ts-ignore
  const nodeList: HTMLElement[] = Object.prototype.isPrototypeOf.call(NodeList.prototype, nodes) ? nodes : [nodes]

  nodeList.forEach((node: HTMLElement) => {
    run(node, getDateAttribute(node), lc, opts || {})
  })

  return nodeList
}
