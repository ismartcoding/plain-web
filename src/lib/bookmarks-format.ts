import type { Bookmark, BookmarkGroup } from '@/stores/bookmarks'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function exportBookmarksHtml(bookmarks: Bookmark[], groups: BookmarkGroup[]): void {
  const lines: string[] = []
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
  lines.push('<!-- This is an automatically generated file. -->')
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">')
  lines.push('<TITLE>Bookmarks</TITLE>')
  lines.push('<H1>Bookmarks</H1>')
  lines.push('<DL><p>')

  for (const b of bookmarks.filter((bm) => !bm.groupId)) {
    const addDate = b.createdAt ? Math.floor(new Date(b.createdAt).getTime() / 1000) : ''
    lines.push(`  <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${addDate}">${escapeHtml(b.title || b.url)}</A>`)
  }

  for (const g of groups) {
    lines.push(`  <DT><H3>${escapeHtml(g.name)}</H3>`)
    lines.push('  <DL><p>')
    for (const b of bookmarks.filter((bm) => bm.groupId === g.id)) {
      const addDate = b.createdAt ? Math.floor(new Date(b.createdAt).getTime() / 1000) : ''
      lines.push(`    <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${addDate}">${escapeHtml(b.title || b.url)}</A>`)
    }
    lines.push('  </DL><p>')
  }

  lines.push('</DL><p>')
  const blob = new Blob([lines.join('\n')], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bookmarks_${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export interface ImportCallbacks {
  addBookmarks: (urls: string[], groupId: string) => Promise<Bookmark[]>
  findGroupByName: (name: string) => BookmarkGroup | undefined
}

export function importBookmarksHtml(callbacks: ImportCallbacks): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.html,.htm'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    const doc = new DOMParser().parseFromString(text, 'text/html')

    async function walkDL(dl: Element, groupId: string) {
      const urlsBatch: string[] = []
      for (const child of Array.from(dl.children)) {
        if (child.tagName !== 'DT') continue
        const h3 = child.querySelector(':scope > h3')
        const nestedDL = child.querySelector(':scope > dl')
        const a = child.querySelector(':scope > a')

        if (h3 && nestedDL) {
          if (urlsBatch.length) {
            await callbacks.addBookmarks([...urlsBatch], groupId)
            urlsBatch.length = 0
          }
          const groupName = h3.textContent?.trim() ?? ''
          const existing = callbacks.findGroupByName(groupName)
          await walkDL(nestedDL, existing?.id ?? '')
        } else if (a) {
          const href = (a as HTMLAnchorElement).getAttribute('href') ?? ''
          if (href.startsWith('http://') || href.startsWith('https://')) {
            urlsBatch.push(href)
          }
        }
      }
      if (urlsBatch.length) {
        await callbacks.addBookmarks(urlsBatch, groupId)
      }
    }

    const rootDL = doc.querySelector('dl')
    if (rootDL) await walkDL(rootDL, '')
  }
  input.click()
}
