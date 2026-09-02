import { describe, it, expect, vi } from 'vitest'
import { preventUnhandledFileDrop } from '@/lib/file-drop'

preventUnhandledFileDrop()

function fire(type: string, types: string[], target: EventTarget = window): Event {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'dataTransfer', { value: { types } })
  target.dispatchEvent(e)
  return e
}

describe('preventUnhandledFileDrop', () => {
  it('cancels a file drop that no component handled', () => {
    expect(fire('drop', ['Files']).defaultPrevented).toBe(true)
  })

  it('cancels dragover so the drop event can fire at all', () => {
    expect(fire('dragover', ['Files']).defaultPrevented).toBe(true)
  })

  it('leaves text drops to the browser', () => {
    expect(fire('drop', ['text/plain']).defaultPrevented).toBe(false)
    expect(fire('dragover', ['text/plain']).defaultPrevented).toBe(false)
  })

  it('leaves drops on a file input to the browser', () => {
    const input = document.createElement('input')
    input.type = 'file'
    document.body.appendChild(input)
    expect(fire('drop', ['Files'], input).defaultPrevented).toBe(false)
    input.remove()
  })

  it('does not touch a drop a component already handled', () => {
    const e = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(e, 'dataTransfer', { value: { types: ['Files'] } })
    e.preventDefault()
    const spy = vi.spyOn(e, 'preventDefault')
    window.dispatchEvent(e)
    expect(spy).not.toHaveBeenCalled()
  })
})
