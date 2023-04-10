export class LineItem {
  line = ''
  key = ''
  value = ''

  update(k: string, v: string) {
    // eslint-disable-next-line
    this.line = this.line.replace(new RegExp(`^(${k}\s*=\s*).+$`), (_match, p1) => {
      return p1 + v
    })
    this.value = v
  }

  static create(k: string, v: string) {
    const item = new LineItem()
    item.key = k
    item.value = v
    item.line = `${k} = ${v}`
    return item
  }
}

export function parseConfigString(config: string) {
  const items: LineItem[] = []
  const lines = config.split('\n')
  for (const line of lines) {
    const split = line.split('=')
    const item = new LineItem()
    item.line = line
    if (split.length > 1) {
      item.key = split[0].trimEnd()
      item.value = split[1].trimStart()
    }
    items.push(item)
  }

  return items
}

export function updateLineItem(items: LineItem[], key: string, value: string) {
  let item = items.find((it) => it.key == key)
  if (item) {
    item.update(key, value)
  } else {
    item = LineItem.create(key, value)
    items.push(item)
  }
}
