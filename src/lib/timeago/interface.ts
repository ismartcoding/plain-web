export type TDate = Date | string | number

export type TimerPool = Record<number, number>

export type Opts = {
  readonly relativeDate?: TDate
  readonly minInterval?: number
}

/**
 * Localization payload for one locale's timeago formatter. Provided by
 * `src/locales/<locale>/timeago.ts` and registered with `setMessages()`
 * on language switch. `plural` lets locales with non-trivial plural
 * rules (e.g. Arabic) do the work in one place instead of pre-baking
 * every variant.
 */
export interface TimeagoMessages {
  readonly justNow: [string, string]
  readonly units: ReadonlyArray<{
    readonly single: string
    readonly many: string
  }>
  readonly template: {
    readonly past: string
    readonly future: string
  }
  readonly plural: (n: number, single: string, many: string) => string
}
