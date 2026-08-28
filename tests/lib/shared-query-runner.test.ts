import { describe, expect, it, vi } from 'vitest'
import { createSharedQueryRunner } from '@/lib/shared-query-runner'

function deferred() {
  let resolve!: () => void
  return { promise: new Promise<void>((done) => { resolve = done }), resolve }
}

describe('shared query runner', () => {
  it('joins repeated forced loads while one forced load is in flight', async () => {
    const request = deferred()
    const run = vi.fn(() => request.promise)
    const runner = createSharedQueryRunner(run)

    const first = runner.execute(true)
    const second = runner.execute(true)
    expect(run).toHaveBeenCalledOnce()
    expect(second).toBe(first)
    request.resolve()
    await first
  })

  it('lets a forced load supersede an ordinary in-flight load', async () => {
    const ordinary = deferred()
    const forced = deferred()
    const run = vi.fn((force: boolean) => force ? forced.promise : ordinary.promise)
    const runner = createSharedQueryRunner(run)

    const old = runner.execute(false)
    const fresh = runner.execute(true)
    expect(run).toHaveBeenCalledTimes(2)
    forced.resolve()
    await fresh
    ordinary.resolve()
    await old
  })
})
