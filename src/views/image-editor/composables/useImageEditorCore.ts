import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type {
  EditorLayer, EditorTool,
  FreehandLayer,
} from '@/views/image-editor/utils/types'
import { TOOL_COLORS, LINE_WIDTHS, hitTestLayer, isEditorTextLayer, getEditorLayerBounds } from '@/views/image-editor/utils/types'
import { renderEditorCanvas, drawSelectionRect, drawHoverRect } from '@/views/image-editor/utils/renderer'
import { updateLayerFromDrag } from '@/views/image-editor/utils/drag-helpers'
import { drawDistanceGuides, drawCenterCrosshair } from '@/views/image-editor/utils/overlay-guides'
import { shortUUID } from '@/lib/strutil'
import { useImageEditorDoc } from './useImageEditorDoc'
import { useImageEditorDocBinding } from './useImageEditorDocBinding'
import { useImageEditorUndo } from './useImageEditorUndo'
import { useImageEditorPersistence } from './useImageEditorPersistence'
import { useImageEditorSticker } from './useImageEditorSticker'
import { useImageEditorExport } from './useImageEditorExport'
import { useImageEditorLayers, resetLayerCounter, nextLayerName } from './useImageEditorLayers'
import { useEditorTransform } from './useEditorTransform'
import { useEditorCrop } from './useEditorCrop'
import { PlainAppProjectStore } from '../store/plain-app-store'
import { EventSyncTransport } from '../sync/event-sync-transport'
import { PixiEditorRenderer } from '../pixi/PixiEditorRenderer'

export function useImageEditorCore() {
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const overlayRef = ref<HTMLCanvasElement | null>(null)
  const wrapRef = ref<HTMLElement | null>(null)

  const doc = useImageEditorDoc()
  const binding = useImageEditorDocBinding(doc)
  const undo = useImageEditorUndo(doc)
  const store = new PlainAppProjectStore()
  const pixi = new PixiEditorRenderer()

  const { canvasSize, bgColor, imgOffset, imgAlpha, sourceImg, layers, layerImages } = binding

  const editorActive = ref(false)
  const renderScale = ref(1)

  const activeTool = ref<EditorTool>('select')
  const activeColor = ref(TOOL_COLORS[0]!)
  const activeLineWidth = ref(LINE_WIDTHS[1]!)
  const activeFontSize = ref(48)

  const selectedLayerId = ref<string | null>(null)

  const isDrawing = ref(false)
  const drawStart = ref<{ x: number; y: number } | null>(null)
  const previewLayer = ref<EditorLayer | null>(null)

  const isDraggingImage = ref(false)
  const imgDragStart = ref<{ mx: number; my: number; ox: number; oy: number } | null>(null)

  const isDraggingLayer = ref(false)
  const layerDragStart = ref<{ mx: number; my: number } | null>(null)

  const isFullscreen = ref(true)

  const inlineEditLayerId = ref<string | null>(null)
  const hoveredLayerId = ref<string | null>(null)

  const selectedLayer = computed(() =>
    layers.find(l => l.id === selectedLayerId.value) ?? null,
  )

  let _pushUndo: () => void = () => {}
  let _scheduleSave: () => void = () => {}
  let _drawAll: () => void = () => {}

  const transform = useEditorTransform(layers, selectedLayerId, doc, () => _pushUndo())
  const { overlayCursor } = transform

  const crop = useEditorCrop(
    canvasRef, canvasSize, sourceImg, imgOffset, layers,
    bgColor, layerImages, imgAlpha, doc,
    () => _pushUndo(), activeTool, () => _drawAll(), () => _scheduleSave(),
    renderScale,
  )
  const { isCropping, cropRect } = crop

  watch(activeTool, (tool) => {
    if (tool === 'crop') {
      const { width: cw, height: ch } = canvasSize.value
      cropRect.value = { x: 0, y: 0, w: cw, h: ch }
      isCropping.value = true
    }
  })

  function draw() {
    if (!pixi.isReady) return
    pixi.sync({
      canvasSize: canvasSize.value,
      bgColor: bgColor.value,
      sourceImg: sourceImg.value,
      imgOffset: { x: imgOffset.x, y: imgOffset.y },
      imgAlpha: imgAlpha.value,
      layers,
      layerImages,
      previewLayer: previewLayer.value,
      hideLayerId: inlineEditLayerId.value,
    })
  }

  function drawOverlay() {
    const overlay = overlayRef.value
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    if (!ctx) return
    const s = renderScale.value
    ctx.setTransform(s, 0, 0, s, 0, 0)
    ctx.clearRect(0, 0, canvasSize.value.width, canvasSize.value.height)
    crop.drawCropIfActive(ctx)
    if (inlineEditLayerId.value) return

    const hovered = hoveredLayerId.value
    if (hovered && hovered !== selectedLayerId.value) {
      const hLayer = layers.find(l => l.id === hovered)
      if (hLayer?.visible) drawHoverRect(ctx, hLayer)
    }

    const sel = selectedLayer.value
    if (sel?.visible) {
      drawSelectionRect(ctx, sel, s)
      if (isDraggingLayer.value) {
        drawCenterCrosshair(ctx, canvasSize.value.width, canvasSize.value.height)
        const bounds = getEditorLayerBounds(sel)
        drawDistanceGuides(ctx, bounds, canvasSize.value.width, canvasSize.value.height)
      }
    }
  }

  function drawAll() { draw(); drawOverlay() }

  watch(binding.syncVersion, () => drawAll())
  watch(canvasSize, () => drawAll(), { deep: true })
  watch(bgColor, () => drawAll())
  watch(imgAlpha, () => drawAll())

  watch(canvasRef, async (canvas) => {
    if (!canvas) return
    if (!pixi.isReady) {
      await pixi.init(canvas)
    }
    const w = Math.max(1, Math.round(canvasSize.value.width * renderScale.value))
    const h = Math.max(1, Math.round(canvasSize.value.height * renderScale.value))
    pixi.resize(w, h)
    pixi.setViewport(renderScale.value, 0, 0)
    drawAll()
  })

  watch(renderScale, () => {
    if (!pixi.isReady) return
    const w = Math.max(1, Math.round(canvasSize.value.width * renderScale.value))
    const h = Math.max(1, Math.round(canvasSize.value.height * renderScale.value))
    pixi.resize(w, h)
    pixi.setViewport(renderScale.value, 0, 0)
  })

  const { canUndo, canRedo, pushUndo, undo: undoFn, redo: redoFn, clearHistory } = undo

  function makeThumbnail(): string | null {
    try {
      const maxDim = 200
      const { width: cw, height: ch } = canvasSize.value
      const scale = Math.min(maxDim / cw, maxDim / ch, 1)
      const tw = Math.round(cw * scale)
      const th = Math.round(ch * scale)
      const tmp = document.createElement('canvas')
      tmp.width = tw; tmp.height = th
      const ctx = tmp.getContext('2d', { willReadFrequently: true })!
      ctx.scale(scale, scale)
      renderEditorCanvas(ctx, sourceImg.value, imgOffset, [...layers], canvasSize.value, bgColor.value, null, layerImages, undefined, imgAlpha.value)
      return tmp.toDataURL('image/jpeg', 0.6)
    } catch { return null }
  }

  function onRestored() {
    const dataUrl = doc.getSourceImage()
    if (dataUrl) {
      const img = new Image()
      img.onload = () => {
        sourceImg.value = img
        clearHistory()
        nextTick(() => drawAll())
      }
      img.onerror = () => {
        clearHistory()
        nextTick(() => drawAll())
      }
      img.src = dataUrl
    } else {
      clearHistory()
      nextTick(() => drawAll())
    }
  }

  const {
    projectId, scheduleSave, flushSave, tryRestore, ensureProjectId, clearProject,
    listRecentProjects, loadProjectById,
  } = useImageEditorPersistence(doc, store, editorActive, makeThumbnail, onRestored)

  const transport = new EventSyncTransport(() => projectId.value)

  _pushUndo = pushUndo
  _scheduleSave = scheduleSave
  _drawAll = drawAll

  doc.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote' || origin === 'load') return
    transport.broadcastUpdate(update)
  })
  transport.onUpdate((update) => {
    doc.applyRemoteUpdate(update)
  })

  watch(binding.syncVersion, () => { scheduleSave() })

  function loadImage(file: File) {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          pushUndo()
          const dataUrl = reader.result as string
          sourceImg.value = img
          doc.ydoc.transact(() => {
            doc.setSourceImage(dataUrl)
            doc.setCanvasSize(img.naturalWidth, img.naturalHeight)
            doc.setImgOffset(0, 0)
            doc.clearLayers()
          })
          selectedLayerId.value = null; resetLayerCounter()
          editorActive.value = true
          nextTick(() => { drawAll() })
          resolve()
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
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
    nextTick(() => { drawAll() })
  }

  function clientToCanvas(e: PointerEvent): { x: number; y: number } | null {
    const canvas = canvasRef.value
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * canvasSize.value.width / rect.width,
      y: (e.clientY - rect.top) * canvasSize.value.height / rect.height,
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    const pos = clientToCanvas(e)
    if (!pos) return

    if (activeTool.value === 'select') {
      if (transform.beginTransform(pos)) return

      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i]!
        if (l.visible && hitTestLayer(l, pos.x, pos.y)) {
          selectedLayerId.value = l.id
          pushUndo()
          isDraggingLayer.value = true
          layerDragStart.value = { mx: pos.x, my: pos.y }
          drawOverlay()
          return
        }
      }
      selectedLayerId.value = null; drawOverlay()
      if (sourceImg.value) {
        pushUndo()
        isDraggingImage.value = true
        imgDragStart.value = { mx: e.clientX, my: e.clientY, ox: imgOffset.x, oy: imgOffset.y }
      }
      return
    }

    if (crop.cropPointerDown(pos, isDrawing, drawStart)) return

    if (activeTool.value === 'text') {
      pushUndo()
      const layer = createRichTextLayer(pos.x, pos.y)
      doc.addLayer(layer)
      selectedLayerId.value = layer.id
      activeTool.value = 'select'
      return
    }

    if (activeTool.value === 'sticker') {
      pushUndo()
      const layer = createStickerLayer(pos.x, pos.y)
      doc.addLayer(layer)
      selectedLayerId.value = layer.id
      activeTool.value = 'select'
      return
    }

    if (activeTool.value === 'brush') {
      isDrawing.value = true
      drawStart.value = pos
      const layer: FreehandLayer = {
        id: shortUUID(), type: 'freehand', visible: true,
        name: nextLayerName('Brush'),
        points: [{ x: pos.x, y: pos.y }],
        color: activeColor.value,
        lineWidth: activeLineWidth.value,
      }
      previewLayer.value = layer
      return
    }

    isDrawing.value = true; drawStart.value = pos
    previewLayer.value = createLayerFromDrag(activeTool.value, pos, pos)
  }

  function onPointerMove(e: PointerEvent) {
    if (isDraggingImage.value && imgDragStart.value) {
      const wrap = wrapRef.value
      if (!wrap) return
      const scaleX = canvasSize.value.width / wrap.clientWidth
      const scaleY = canvasSize.value.height / wrap.clientHeight
      const newX = imgDragStart.value.ox + (e.clientX - imgDragStart.value.mx) * scaleX
      const newY = imgDragStart.value.oy + (e.clientY - imgDragStart.value.my) * scaleY
      doc.setImgOffset(newX, newY)
      return
    }

    const pos = clientToCanvas(e)
    if (!pos) return

    if (transform.updateTransform(pos)) return

    if (isDraggingLayer.value && layerDragStart.value && selectedLayer.value) {
      doc.moveLayerBy(selectedLayer.value.id, pos.x - layerDragStart.value.mx, pos.y - layerDragStart.value.my)
      layerDragStart.value = { mx: pos.x, my: pos.y }
      return
    }

    if (activeTool.value === 'select' && !isDraggingLayer.value && !isDrawing.value) {
      overlayCursor.value = transform.getCursorForHandle(pos)
      let newHover: string | null = null
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i]!
        if (l.visible && hitTestLayer(l, pos.x, pos.y)) { newHover = l.id; break }
      }
      if (newHover !== hoveredLayerId.value) { hoveredLayerId.value = newHover; drawOverlay() }
    }

    if (activeTool.value === 'crop' && cropRect.value && !isDrawing.value) {
      const cursor = crop.getCropCursor(pos)
      if (cursor) overlayCursor.value = cursor
    }

    if (crop.cropPointerMove(pos, isDrawing, drawStart, draw)) return

    if (!isDrawing.value || !drawStart.value) return
    if (previewLayer.value) {
      if (previewLayer.value.type === 'freehand') {
        (previewLayer.value as FreehandLayer).points.push({ x: pos.x, y: pos.y }); draw()
      } else {
        updateLayerFromDrag(previewLayer.value, drawStart.value, pos, e.shiftKey); draw()
      }
    }
  }

  function onPointerUp() {
    if (isDraggingImage.value) { isDraggingImage.value = false; imgDragStart.value = null; return }
    if (transform.isActive.value) { transform.endTransform(); return }
    if (isDraggingLayer.value) { isDraggingLayer.value = false; layerDragStart.value = null; drawOverlay(); return }
    if (!isDrawing.value) return
    isDrawing.value = false
    crop.cropPointerUp()
    if (activeTool.value === 'crop') return
    if (previewLayer.value) {
      const bounds = getBoundsSize(previewLayer.value)
      if (bounds > 4) {
        pushUndo()
        doc.addLayer(previewLayer.value)
        if (previewLayer.value.type === 'image') {
          // image src is handled separately via doc.setImageSrc in addImageLayerFromFile
        }
        selectedLayerId.value = previewLayer.value.id
      }
      previewLayer.value = null
    }
  }

  function onDoubleClick(e: MouseEvent) {
    const pos = clientToCanvas(e as unknown as PointerEvent)
    if (!pos) return
    if (crop.onDoubleClickCrop(pos)) return null
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i]!
      if (l.visible && hitTestLayer(l, pos.x, pos.y) && (isEditorTextLayer(l) || l.type === 'sticker')) {
        return l.id
      }
    }
    return null
  }

  const {
    createRichTextLayer, addTextLayer,
    addImageLayerFromFile, replaceImageLayerFile,
    createLayerFromDrag, getBoundsSize,
    removeLayer, reorderLayer, toggleLayerVisibility, clearLayers,
  } = useImageEditorLayers(layers, layerImages, canvasSize, selectedLayerId, activeColor, activeLineWidth, activeFontSize, doc, pushUndo)

  const {
    createStickerLayer, addStickerLayer,
    autoResizeSticker, updateStickerText, updateStickerFontSize,
    toggleStickerBold, toggleStickerItalic,
  } = useImageEditorSticker(layers, canvasSize, selectedLayerId, doc, pushUndo, nextLayerName)

  const { download, copyToClipboard, getPreviewDataUrl } = useImageEditorExport(
    canvasSize, sourceImg, imgOffset, layers, bgColor, layerImages, imgAlpha,
  )

  function resizeCanvas(w: number, h: number) {
    pushUndo()
    doc.setCanvasSize(w, h)
    nextTick(() => drawAll())
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

  function onKeyDown(e: KeyboardEvent) {
    const key = e.key.toLowerCase()
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'z') { e.preventDefault(); redoFn(); return }
    if ((e.metaKey || e.ctrlKey) && key === 'z') { e.preventDefault(); undoFn(); return }
    if (e.key === 'Escape') {
      if (isCropping.value) { crop.cancelCrop(); return }
      selectedLayerId.value = null; activeTool.value = 'select'; drawOverlay()
    }
  }

  function onBeforeUnload() {
    flushSave()
  }

  onMounted(async () => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.body.style.overflow = 'hidden'
    const restored = await tryRestore()
    if (!restored) ensureProjectId()
    await transport.connect()
    if (restored) {
      nextTick(() => drawAll())
    } else {
      drawAll()
    }
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('beforeunload', onBeforeUnload)
    flushSave()
    document.body.style.overflow = ''; document.body.style.top = ''
    document.body.style.left = ''; document.body.style.right = ''
    pixi.destroy()
    transport.destroy()
    binding.dispose()
    undo.dispose()
    doc.destroy()
  })

  return {
    canvasRef, overlayRef, wrapRef,
    doc, binding,
    sourceImg, imgOffset, canvasSize, bgColor, imgAlpha, editorActive,
    activeTool, activeColor, activeLineWidth, activeFontSize, renderScale,
    layers, selectedLayerId, selectedLayer, layerImages,
    isCropping, cropRect, canUndo, canRedo, isFullscreen,
    inlineEditLayerId, overlayCursor,
    draw: drawAll, loadImage, startBlank,
    onPointerDown, onPointerMove, onPointerUp, onDoubleClick,
    undo: undoFn, redo: redoFn, applyCrop: crop.applyCrop, cancelCrop: crop.cancelCrop, pushUndo,
    clearLayers, removeLayer, reorderLayer, toggleLayerVisibility,
    addTextLayer, addStickerLayer, addImageLayerFromFile, replaceImageLayerFile,
    autoResizeSticker, updateStickerText, updateStickerFontSize,
    toggleStickerBold, toggleStickerItalic,
    download, copyToClipboard, getPreviewDataUrl, resizeCanvas, setBgColor, setSourceImg, reset,
    scheduleSave, listRecentProjects, loadProjectById,
  }
}
