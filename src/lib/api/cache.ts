/**
 * In-memory stale-while-revalidate cache.
 *
 * Data is keyed by string and lives for the browser session (cleared on page
 * refresh). The pattern is:
 *   1. Check cache → pre-populate state immediately (no loading flash)
 *   2. Always fetch fresh data in the background
 *   3. Replace state with fresh data when it arrives
 *
 * Used by Pinia stores (sms, chat, etc.) to avoid the blank loading state
 * when navigating back to a page that was already visited.
 */
const _store = new Map<string, unknown>()

export function getCached<T>(key: string): T | undefined {
  return _store.get(key) as T | undefined
}

export function setCached<T>(key: string, data: T): void {
  _store.set(key, data)
}
