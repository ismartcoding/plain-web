import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
import { useImageEditorLayers, nextLayerName } from './useImageEditorLayers'
import { useEditorTransform } from './useEditorTransform'
import { useEditorCrop } from './useEditorCrop'
import { useEditorImage } from './useEditorImage'
import { PlainAppProjectStore } from '../store/plain-app-store'
import { EventSyncTransport } from '../sync/event-sync-transport'
import { PixiEditorRenderer } from '../pixi/PixiEditorRenderer'
import { RenderScheduler } from './useRenderScheduler'

export function useImageEditorCore() {
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const overlayRef = ref<HTMLCanvasElement | null>(null)
  const wrapRef = ref<HTMLElement | null>(null)

  const doc = useImageEditorDoc()
  const binding = useImageEditorDocBinding(doc)
  const undo = useImageEditorUndo(doc)
  const store = new PlainAppProjectStore()
  const pixi = new PixiEditorRenderer()
  const scheduler = new RenderScheduler()

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
  let isLoading = false

  function requestRender() { scheduler.requestMain() }
  function requestOverlay() { scheduler.requestOverlay() }

  const transform = useEditorTransform(layers, selectedLayerId, doc, () => _pushUndo())
  const { overlayCursor } = transform

  const crop = useEditorCrop(
    canvasSize, sourceImg, imgOffset, layers,
    bgColor, layerImages, imgAlpha, doc,
    () => _pushUndo(), activeTool, requestRender, () => _scheduleSave(),
  )
  const { isCropping, cropRect } = crop

  watch(activeTool, (tool) => {
    if (tool === 'crop') {
      cropRect.value = null
      isCropping.value = true
      requestRender()
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

  scheduler.setRenderers(draw, drawOverlay)

  watch(binding.syncVersion, () => requestRender())
  watch(selectedLayerId, () => requestOverlay())
  watch(hoveredLayerId, () => requestOverlay())
  watch(isDraggingLayer, () => requestOverlay())

  watch(canvasRef, async (canvas) => {
    if (!canvas) return
    if (!pixi.isReady) {
      await pixi.init(canvas)
    }
    const w = Math.max(1, Math.round(canvasSize.value.width * renderScale.value))
    const h = Math.max(1, Math.round(canvasSize.value.height * renderScale.value))
    pixi.resize(w, h)
    pixi.setViewport(renderScale.value, 0, 0)
    requestRender()
  })

  watch(renderScale, () => {
    if (!pixi.isReady) return
    const w = Math.max(1, Math.round(canvasSize.value.width * renderScale.value))
    const h = Math.max(1, Math.round(canvasSize.value.height * renderScale.value))
    pixi.resize(w, h)
    pixi.setViewport(renderScale.value, 0, 0)
    requestRender()
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
        requestRender()
      }
      img.onerror = () => {
        clearHistory()
        requestRender()
      }
      img.src = dataUrl
    } else {
      clearHistory()
      requestRender()
    }
  }

  const {
    projectId, scheduleSave, flushSave, tryRestore, ensureProjectId, clearProject, deleteProject,
    listRecentProjects, loadProjectById,
  } = useImageEditorPersistence(doc, store, editorActive, makeThumbnail, onRestored)

  const transport = new EventSyncTransport(() => projectId.value)

  _pushUndo = pushUndo
  _scheduleSave = scheduleSave

  doc.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote' || origin === 'load') return
    transport.broadcastUpdate(update)
  })
  transport.onUpdate((update) => {
    doc.applyRemoteUpdate(update)
  })

  watch(binding.syncVersion, () => { if (!isLoading) scheduleSave() })

  const imageApi = useEditorImage({
    doc, sourceImg, selectedLayerId, activeTool, previewLayer, editorActive,
    pushUndo, requestRender, scheduleSave, clearHistory, clearProject,
  })

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
          requestRender()
          return
        }
      }
      selectedLayerId.value = null; requestRender()
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
      requestRender()
      return
    }

    isDrawing.value = true; drawStart.value = pos
    selectedLayerId.value = null
    previewLayer.value = createLayerFromDrag(activeTool.value, pos, pos)
    requestRender()
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
      if (newHover !== hoveredLayerId.value) { hoveredLayerId.value = newHover }
    }

    if (activeTool.value === 'crop' && cropRect.value && !isDrawing.value) {
      const cursor = crop.getCropCursor(pos)
      if (cursor) overlayCursor.value = cursor
    }

    if (crop.cropPointerMove(pos, isDrawing, drawStart)) return

    if (!isDrawing.value || !drawStart.value) return
    if (previewLayer.value) {
      if (previewLayer.value.type === 'freehand') {
        (previewLayer.value as FreehandLayer).points.push({ x: pos.x, y: pos.y }); requestRender()
      } else {
        updateLayerFromDrag(previewLayer.value, drawStart.value, pos, e.shiftKey); requestRender()
      }
    }
  }

  function onPointerUp() {
    if (isDraggingImage.value) { isDraggingImage.value = false; imgDragStart.value = null; return }
    if (transform.isActive.value) { transform.endTransform(); return }
    if (isDraggingLayer.value) { isDraggingLayer.value = false; layerDragStart.value = null; requestRender(); return }
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

  const { download, copyToClipboard, getPreviewBlobUrl } = useImageEditorExport(
    canvasSize, sourceImg, imgOffset, layers, bgColor, layerImages, imgAlpha,
  )

  function resizeCanvas(w: number, h: number) {
    pushUndo()
    doc.setCanvasSize(w, h)
    requestRender()
  }


  function onKeyDown(e: KeyboardEvent) {
    const key = e.key.toLowerCase()
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'z') { e.preventDefault(); redoFn(); return }
    if ((e.metaKey || e.ctrlKey) && key === 'z') { e.preventDefault(); undoFn(); return }
    if (e.key === 'Escape') {
      if (isCropping.value) { crop.cancelCrop(); return }
      selectedLayerId.value = null; activeTool.value = 'select'; requestRender()
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
    requestRender()
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('beforeunload', onBeforeUnload)
    flushSave()
    document.body.style.overflow = ''; document.body.style.top = ''
    document.body.style.left = ''; document.body.style.right = ''
    pixi.destroy()
    scheduler.dispose()
    transport.destroy()
    binding.dispose()
    undo.dispose()
    doc.destroy()
  })

  return {
    canvasRef, overlayRef, wrapRef,
    doc, binding,
    state: {
      sourceImg, imgOffset, canvasSize, bgColor, imgAlpha, editorActive,
      isFullscreen, inlineEditLayerId, renderScale,
      layers, selectedLayerId, selectedLayer, layerImages,
    },
    tools: { activeTool, activeColor, activeLineWidth, activeFontSize, overlayCursor },
    crop: { isCropping, cropRect, applyCrop: crop.applyCrop, cancelCrop: crop.cancelCrop },
    history: { undo: undoFn, redo: redoFn, canUndo, canRedo, pushUndo },
    render: { draw: requestRender, resizeCanvas },
    image: imageApi,
    pointer: { onPointerDown, onPointerMove, onPointerUp, onDoubleClick },
    layerOps: {
      clearLayers, removeLayer, reorderLayer, toggleLayerVisibility,
      addTextLayer, addStickerLayer, addImageLayerFromFile, replaceImageLayerFile,
    },
    sticker: {
      autoResizeSticker, updateStickerText, updateStickerFontSize,
      toggleStickerBold, toggleStickerItalic,
    },
    exportOps: { download, copyToClipboard, getPreviewBlobUrl },
    persistence: { scheduleSave, listRecentProjects, loadProjectById, deleteProject },
  }
}
