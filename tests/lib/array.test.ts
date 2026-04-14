import { describe, it, expect, vi } from 'vitest'
import { deleteById, arrayRemove, sample, debounce, truncateText } from '@/lib/array'

describe('deleteById', () => {
  it('removes the item with the matching id', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }] as [{ id: string }]
    deleteById(items, '2')
    expect(items).toHaveLength(2)
    expect(items.find((i) => i.id === '2')).toBeUndefined()
  })

  it('does nothing if id is not found', () => {
    const items = [{ id: '1' }, { id: '2' }] as [{ id: string }]
    deleteById(items, '99')
    expect(items).toHaveLength(2)
  })

  it('removes only the first matching item', () => {
    const items = [{ id: '1' }, { id: '1' }, { id: '2' }] as [{ id: string }]
    deleteById(items, '1')
    expect(items).toHaveLength(2)
    expect(items[0].id).toBe('1') // second one still present
  })

  it('handles an empty array gracefully', () => {
    const items = [] as unknown as [{ id: string }]
    expect(() => deleteById(items, '1')).not.toThrow()
  })
})

describe('arrayRemove', () => {
  it('removes all items matching the predicate', () => {
    const arr = [1, 2, 3, 4, 5]
    arrayRemove(arr, (n) => n % 2 === 0)
    expect(arr).toEqual([1, 3, 5])
  })

  it('removes nothing when predicate never matches', () => {
    const arr = [1, 2, 3]
    arrayRemove(arr, (n) => n > 100)
    expect(arr).toEqual([1, 2, 3])
  })

  it('removes all items when predicate always matches', () => {
    const arr = [1, 2, 3]
    arrayRemove(arr, () => true)
    expect(arr).toHaveLength(0)
  })

  it('handles empty array', () => {
    const arr: number[] = []
    arrayRemove(arr, () => true)
    expect(arr).toHaveLength(0)
  })

  it('removes duplicate values matching predicate', () => {
    const arr = [1, 2, 2, 3, 2]
    arrayRemove(arr, (n) => n === 2)
    expect(arr).toEqual([1, 3])
  })

  it('mutates the original array in-place', () => {
    const arr = [10, 20, 30]
    const ref = arr
    arrayRemove(arr, (n) => n === 20)
    expect(ref).toBe(arr) // same reference
  })

  it('works with objects via predicate', () => {
    const arr = [{ active: true }, { active: false }, { active: true }]
    arrayRemove(arr, (item) => !item.active)
    expect(arr).toHaveLength(2)
    expect(arr.every((i) => i.active)).toBe(true)
  })
})

describe('sample', () => {
  it('returns undefined for an empty array', () => {
    expect(sample([])).toBeUndefined()
  })

  it('returns the only element for a single-element array', () => {
    expect(sample(['x'])).toBe('x')
  })

  it('returns an element that exists in the array', () => {
    const arr = [10, 20, 30, 40, 50]
    const result = sample(arr)
    expect(arr).toContain(result)
  })

  it('returns different elements over many calls (probabilistic)', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const results = new Set(Array.from({ length: 100 }, () => sample(arr)))
    // Very unlikely to pick only one value 100 times
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('debounce', () => {
  it('does not call the function immediately', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('calls the function after the delay', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('only calls the function once when triggered multiple times within delay', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    debounced()
    debounced()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('resets the timer on each call', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)
    debounced()
    vi.advanceTimersByTime(50)
    debounced() // reset timer
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled() // 50ms since last call, not 100
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('passes arguments to the underlying function', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 50)
    debounced('hello', 42)
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledWith('hello', 42)
    vi.useRealTimers()
  })
})

describe('truncateText', () => {
  it('returns the string unchanged if within length', () => {
    expect(truncateText('hello', 10)).toBe('hello')
  })

  it('returns the string unchanged if exactly at length', () => {
    expect(truncateText('hello', 5)).toBe('hello')
  })

  it('truncates and appends "..." when over length', () => {
    expect(truncateText('hello world', 8)).toBe('hello...')
  })

  it('truncated text total length equals the limit', () => {
    const result = truncateText('abcdefghij', 7)
    expect(result).toHaveLength(7)
    expect(result.endsWith('...')).toBe(true)
  })

  it('handles empty string', () => {
    expect(truncateText('', 5)).toBe('')
  })

  it('keeps exactly (length-3) chars before ellipsis', () => {
    const result = truncateText('abcdefgh', 6)
    expect(result).toBe('abc...')
  })
})
