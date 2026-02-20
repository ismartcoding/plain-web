import MarkdownIt from 'markdown-it'
import subscript from 'markdown-it-sub'
import superscript from 'markdown-it-sup'
import footnote from 'markdown-it-footnote'
import deflist from 'markdown-it-deflist'
import abbreviation from 'markdown-it-abbr'
import insert from 'markdown-it-ins'
import mark from 'markdown-it-mark'
import katex from 'markdown-it-katex'
import tasklists from 'markdown-it-task-lists'
import type { Ref } from 'vue'
import { parseDocument } from 'htmlparser2'
import { render } from 'dom-serializer'
import { getFileUrlByPath } from '@/lib/api/file'
import type sjcl from 'sjcl'

async function replaceNodes(nodes: Array<ChildNode>, replace: (link: string) => void) {
  if (!nodes) return
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.attribs) {
      if (node.name === 'img' && node.attribs.src) {
        node.attribs.src = await replace(node.attribs.src)
      }
      if (node.name === 'a' && node.attribs.href) {
        node.attribs.href = await replace(node.attribs.href)
      }
    }
    await replaceNodes(node.children, replace)
  }
}

export const useMarkdown = (app: Ref<{ appDir: string }>, urlTokenKey: Ref<sjcl.BitArray | null>) => {
  const md = new MarkdownIt()
    .use(subscript)
    .use(superscript)
    .use(footnote)
    .use(deflist)
    .use(abbreviation)
    .use(insert)
    .use(mark)
    .use(katex, { throwOnError: false, errorColor: ' #cc0000' })
    .use(tasklists, { enabled: true })
  md.set({
    html: true,
    xhtmlOut: true,
    breaks: true,
    linkify: true,
    typographer: true,
  })

  const replace = (link: string) => {
    if (link.startsWith('app://')) {
      const { appDir } = app.value
      return getFileUrlByPath(urlTokenKey.value, appDir + '/' + link.replace('app://', ''))
    }
    return link
  }

  return {
    render: async (source: string) => {
      const html = md.render(source)
      const dom = parseDocument(html, {
        recognizeCDATA: true,
        recognizeSelfClosing: true,
      })
      await replaceNodes(dom.children, replace)
      return render(dom)
    },
  }
}
