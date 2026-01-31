import { computed } from 'vue'
import type { Router } from 'vue-router'

export type HistoryByPage = Record<string, string[]>

export function usePerPageSearchHistory(opts: {
  router: Router
  mainStore: any
  max: number
  decodeBase64: (s: string) => string
  formatLabel: (decoded: string) => string
}) {
  const pageKey = computed(() => opts.router.currentRoute.value.path || '')

  const historyQ = computed<string[]>(() => {
    const all = (opts.mainStore as any).searchHistory as HistoryByPage | undefined
    return [...((all ?? {})[pageKey.value] ?? [])]
  })

  function setHistoryForPage(next: string[]) {
    const all = ({ ...((opts.mainStore as any).searchHistory ?? {}) } as HistoryByPage)
    if (next.length === 0) delete all[pageKey.value]
    else all[pageKey.value] = next
    ;(opts.mainStore as any).searchHistory = all
  }

  function rememberHistoryDecoded(q: string) {
    const normalized = String(q ?? '').trim()
    if (!normalized) return

    const list = [...(historyQ.value ?? [])]
    const next = [normalized, ...list.filter((it) => it !== normalized)].slice(0, opts.max)
    setHistoryForPage(next)
  }

  function rememberHistoryBase64(qBase64: string) {
    if (!qBase64) return
    try {
      rememberHistoryDecoded(opts.decodeBase64(qBase64))
    } catch {
      // ignore
    }
  }

  function deleteHistoryItem(q: string) {
    if (!q) return
    setHistoryForPage((historyQ.value ?? []).filter((it) => it !== q))
  }

  function clearHistoryForPage() {
    setHistoryForPage([])
  }

  const historyValueOptions = computed(() => {
    return (historyQ.value ?? [])
      .map((q) => ({ value: q, label: opts.formatLabel(q) || q }))
      .filter((it) => it.value)
  })

  return {
    historyQ,
    historyValueOptions,
    rememberHistoryDecoded,
    rememberHistoryBase64,
    deleteHistoryItem,
    clearHistoryForPage,
  }
}
