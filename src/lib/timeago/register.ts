import type { TimeagoMessages } from './interface'
import enUSMessages from '@/locales/en-US/timeago'

const Messages = new Map<string, TimeagoMessages>()

// Eagerly register the fallback locale so getMessages('en-US') always
// resolves even before setLocale() finishes the async chunk load. This
// prevents the `m.now` TypeError that cascaded into `el.__vnode` render
// errors after channel creation / message sending.
Messages.set('en-US', enUSMessages)

export function setMessages(locale: string, messages: TimeagoMessages): void {
  Messages.set(locale, messages)
}

export function getMessages(locale: string): TimeagoMessages | undefined {
  return Messages.get(locale)
}

const timeagoLoaders = import.meta.glob<{ default: TimeagoMessages }>('@/locales/*/timeago.ts')

const inflight = new Map<string, Promise<void>>()
const loaded = new Set<string>()

function pathFor(locale: string): [string, () => Promise<{ default: TimeagoMessages }>] | undefined {
  for (const [path, loader] of Object.entries(timeagoLoaders)) {
    const match = path.match(/[\\/]locales[\\/]([^\\/]+)[\\/]timeago\.ts$/)
    if (match && match[1] === locale) return [path, loader]
  }
  return undefined
}

/**
 * Activate a locale for the timeago formatter. Pulls the matching
 * `src/locales/<locale>/timeago.ts` chunk on first request. Unknown
 * locales and concurrent calls for the same locale resolve without
 * re-fetching.
 */
export function setLocale(locale: string): Promise<void> {
  if (!locale || loaded.has(locale)) return Promise.resolve()
  const existing = inflight.get(locale)
  if (existing) return existing
  const entry = pathFor(locale)
  if (!entry) return Promise.resolve()
  const promise = entry[1]()
    .then((mod) => {
      Messages.set(locale, mod.default)
      loaded.add(locale)
    })
    .finally(() => inflight.delete(locale))
  inflight.set(locale, promise)
  return promise
}
