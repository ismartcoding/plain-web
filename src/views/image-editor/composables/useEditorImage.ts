import type { Ref } from 'vue'
import type { EditorLayer, EditorTool } from '../utils/types'
import type { ImageEditorDoc } from './useImageEditorDoc'
import { resetLayerCounter } from './useImageEditorLayers'

export interface EditorImageContext {
  doc: ImageEditorDoc
  sourceImg: Ref<HTMLImageElement | null>
  selectedLayerId: Ref<string | null>
  activeTool: Ref<EditorTool>
  previewLayer: Ref<EditorLayer | null>
  editorActive: Ref<boolean>
  pushUndo: () => void
  requestRender: () => void
  scheduleSave: () => void
  clearHistory: () => void
  clearProject: () => void
}

export function useEditorImage(ctx: EditorImageContext) {
  const {
    doc, sourceImg, selectedLayerId, activeTool, previewLayer, editorActive,
    pushUndo, requestRender, scheduleSave, clearHistory, clearProject,
  } = ctx

  function loadImage(file: File) {
    return new Promise<void>((resolve, reject) => {
      const blobUrl = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        pushUndo()
        sourceImg.value = img
        doc.ydoc.transact(() => {
          doc.setCanvasSize(img.naturalWidth, img.naturalHeight)
          doc.setImgOffset(0, 0)
          doc.clearLayers()
        })
        selectedLayerId.value = null; resetLayerCounter()
        editorActive.value = true
        requestRender()
        resolve()
        const reader = new FileReader()
        reader.onload = () => {
          doc.setSourceImage(reader.result as string)
          scheduleSave()
        }
        reader.readAsDataURL(file)
      }
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl)
        reject(new Error('Failed to load image'))
      }
      img.src = blobUrl
    })
  }

  function loadImageFromUrl(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        pushUndo()
        sourceImg.value = img
        let dataUrl: string = url
        try {
          const tmp = document.createElement('canvas')
          tmp.width = img.naturalWidth
          tmp.height = img.naturalHeight
          tmp.getContext('2d')!.drawImage(img, 0, 0)
          dataUrl = tmp.toDataURL('image/png')
        } catch {
          // Canvas tainted (cross-origin without CORS) — fall back to URL
        }
        doc.ydoc.transact(() => {
          doc.setSourceImage(dataUrl)
          doc.setCanvasSize(img.naturalWidth, img.naturalHeight)
          doc.setImgOffset(0, 0)
          doc.clearLayers()
        })
        selectedLayerId.value = null; resetLayerCounter()
        editorActive.value = true
        requestRender()
        resolve()
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })
  }

  function startBlank() {
    pushUndo()
    doc.ydoc.transact(() => {
      doc.setSourceImage(null)
      doc.setCanvasSize(1920, 1080)
      doc.setImgOffset(0, 0)
      doc.setBgColor('#ffffff')
      doc.clearLayers()
    })
    selectedLayerId.value = null; resetLayerCounter()
    editorActive.value = true
    requestRender()
  }

  function reset() {
    doc.ydoc.transact(() => {
      doc.setSourceImage(null)
      doc.setCanvasSize(1920, 1080)
      doc.setImgOffset(0, 0)
      doc.setBgColor('transparent')
      doc.clearLayers()
    })
    clearHistory()
    activeTool.value = 'select'
    previewLayer.value = null; selectedLayerId.value = null; resetLayerCounter()
    editorActive.value = false
    clearProject()
  }

  function setBgColor(color: string) {
    pushUndo()
    doc.setBgColor(color)
  }

  function setSourceImg(img: HTMLImageElement | null) {
    if (img) {
      sourceImg.value = img
      doc.setSourceImage(img.src)
    } else {
      doc.setSourceImage(null)
    }
  }

  return { loadImage, loadImageFromUrl, startBlank, reset, setBgColor, setSourceImg }
}
