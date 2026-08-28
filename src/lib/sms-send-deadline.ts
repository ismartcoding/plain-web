export const SMS_SEND_RESULT_TIMEOUT_MS = 5 * 60 * 1000 + 10000

export function createKeyedSmsSendDeadlines(onTimeout: (clientId: string) => void) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function start(clientId: string) {
    settle(clientId)
    timers.set(clientId, setTimeout(() => {
      timers.delete(clientId)
      onTimeout(clientId)
    }, SMS_SEND_RESULT_TIMEOUT_MS))
  }

  function settle(clientId: string): boolean {
    const timer = timers.get(clientId)
    if (!timer) return false
    clearTimeout(timer)
    timers.delete(clientId)
    return true
  }

  function cancelAll() {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
  }

  return { start, settle, cancelAll }
}

export function createSmsSendDeadline(onTimeout: (clientId: string) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingId: string | undefined

  function start(clientId: string) {
    cancel()
    pendingId = clientId
    timer = setTimeout(() => {
      timer = undefined
      const expiredId = pendingId
      pendingId = undefined
      if (expiredId) onTimeout(expiredId)
    }, SMS_SEND_RESULT_TIMEOUT_MS)
  }

  function settle(clientId: string): boolean {
    if (pendingId !== clientId) return false
    cancel()
    return true
  }

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = undefined
    pendingId = undefined
  }

  return { start, settle, cancel }
}
