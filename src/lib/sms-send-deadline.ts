export const SMS_SEND_RESULT_TIMEOUT_MS = 5 * 60 * 1000 + 10000

export function createKeyedSmsSendDeadlines(onTimeout: (requestId: string) => void) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function start(requestId: string) {
    settle(requestId)
    timers.set(requestId, setTimeout(() => {
      timers.delete(requestId)
      onTimeout(requestId)
    }, SMS_SEND_RESULT_TIMEOUT_MS))
  }

  function settle(requestId: string): boolean {
    const timer = timers.get(requestId)
    if (!timer) return false
    clearTimeout(timer)
    timers.delete(requestId)
    return true
  }

  function cancelAll() {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
  }

  return { start, settle, cancelAll }
}

export function createSmsSendDeadline(onTimeout: (requestId: string) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingId: string | undefined

  function start(requestId: string) {
    cancel()
    pendingId = requestId
    timer = setTimeout(() => {
      timer = undefined
      const expiredId = pendingId
      pendingId = undefined
      if (expiredId) onTimeout(expiredId)
    }, SMS_SEND_RESULT_TIMEOUT_MS)
  }

  function settle(requestId: string): boolean {
    if (pendingId !== requestId) return false
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
