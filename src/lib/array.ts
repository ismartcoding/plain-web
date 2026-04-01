export function deleteById(items: [{ id: string }], id: string) {
  const index = items.findIndex((it: { id: string }) => it.id === id)
  if (index !== -1) {
    items.splice(index, 1)
  }
}

export function arrayRemove<T>(array: T[], predicate: (item: T) => boolean): void {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate(array[i])) {
      array.splice(i, 1)
    }
  }
}

export function sample<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined
  return array[Math.floor(Math.random() * array.length)]
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined
  return function (this: any, ...args: any[]) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  } as T
}

export function truncateText(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length - 3) + '...'
}
