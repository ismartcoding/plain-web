import type { Ref } from 'vue'
import type { CanvasSize, EditorLayer } from '@/views/image-editor/utils/types'
import { renderEditorCanvas } from '@/views/image-editor/utils/renderer'

/** Export/download/copy functions for the image editor. */
export function useImageEditorExport(
  canvasSize: Ref<CanvasSize>,
  sourceImg: Ref<HTMLImageElement | null>,
  imgOffset: { x: number; y: number },
  layers: EditorLayer[],
  bgColor: Ref<string>,
  layerImages: Map<string, HTMLImageElement>,
  imgAlpha: Ref<number>,
) {
  function renderToTempCanvas(): HTMLCanvasElement {
    const tmp = document.createElement('canvas')
    tmp.width = canvasSize.value.width; tmp.height = canvasSize.value.height
    const ctx = tmp.getContext('2d', { willReadFrequently: true })!
    renderEditorCanvas(ctx, sourceImg.value, imgOffset, [...layers], canvasSize.value, bgColor.value, null, layerImages, undefined, imgAlpha.value)
    return tmp
  }

  function download(format: 'png' | 'jpeg' | 'webp' = 'png') {
    const tmp = renderToTempCanvas()
    const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
    const quality = format === 'jpeg' ? 0.92 : format === 'webp' ? 0.9 : undefined
    const ext = format === 'jpeg' ? 'jpg' : format
    tmp.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `edited-${Date.now()}.${ext}`
      link.href = url; link.click(); URL.revokeObjectURL(url)
    }, mimeType, quality)
  }

  async function copyToClipboard() {
    const tmp = renderToTempCanvas()
    const blob = await new Promise<Blob | null>(resolve => tmp.toBlob(resolve, 'image/png'))
    if (!blob) return
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  }

  function getPreviewDataUrl(): string {
    return renderToTempCanvas().toDataURL('image/png')
  }

  return { download, copyToClipboard, getPreviewDataUrl }
}
