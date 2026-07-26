import { Application, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js'
import type { EditorLayer, CanvasSize, ArrowLayer, RectLayer, EllipseLayer, HighlightLayer, FreehandLayer, EditorTextLayer, EditorImageLayer, StickerLayer } from '../utils/types'
import { getEditorLayerBounds } from '../utils/types'
import { drawLayer, wrapText } from '../utils/editor-draw-layers'

export interface PixiRenderState {
  canvasSize: CanvasSize
  bgColor: string
  sourceImg: HTMLImageElement | null
  imgOffset: { x: number; y: number }
  imgAlpha: number
  layers: EditorLayer[]
  layerImages: Map<string, HTMLImageElement>
  previewLayer: EditorLayer | null
  hideLayerId: string | null
}

const PAD = 60

function colorToNumber(c: string): number | null {
  if (c.startsWith('#') && c.length === 7) {
    return parseInt(c.slice(1), 16)
  }
  return null
}

function parseGradientColors(value: string): { angle: number; colors: string[] } | null {
  if (value.startsWith('linear-gradient')) {
    const inner = value.replace(/^linear-gradient\(/, '').replace(/\)$/, '')
    const parts = inner.split(',')
    const first = parts[0]!.trim()
    if (first.endsWith('deg')) {
      return { angle: parseFloat(first), colors: parts.slice(1).map(s => s.trim()).filter(Boolean) }
    }
    return { angle: 0, colors: parts.map(s => s.trim()).filter(Boolean) }
  }
  if (value.startsWith('gradient:')) {
    const parts = value.split(':')
    return { angle: parseFloat(parts[2] ?? '0'), colors: [parts[3] ?? '#000000', parts[4] ?? '#ffffff'] }
  }
  return null
}

function makeCheckerboardTexture(): Texture {
  const c = document.createElement('canvas')
  c.width = 32; c.height = 32
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f8f8f8'; ctx.fillRect(0, 0, 32, 32)
  ctx.fillStyle = '#e5e5e5'
  ctx.fillRect(0, 0, 16, 16)
  ctx.fillRect(16, 16, 16, 16)
  return Texture.from(c)
}

function makeGradientTexture(value: string, w: number, h: number): Texture {
  const parsed = parseGradientColors(value)
  const angle = parsed?.angle ?? 0
  const colors = parsed?.colors ?? ['#000000', '#ffffff']
  const c = document.createElement('canvas')
  c.width = Math.max(1, w); c.height = Math.max(1, h)
  const ctx = c.getContext('2d')!
  const rad = ((angle - 90) * Math.PI) / 180
  const cx = w / 2, cy = h / 2
  const diag = Math.sqrt(w * w + h * h) / 2
  const dx = Math.cos(rad) * diag, dy = Math.sin(rad) * diag
  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
  for (let i = 0; i < colors.length; i++) {
    grad.addColorStop(i / Math.max(1, colors.length - 1), colors[i]!)
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  return Texture.from(c)
}

function textLayerHash(l: EditorTextLayer): string {
  return JSON.stringify({
    t: l.text, fs: l.fontSize, c: l.color, ff: l.fontFamily,
    fw: l.fontWeight, fst: l.fontStyle, ta: l.textAlign,
    ls: l.letterSpacing, td: l.textDecoration,
    ts: l.textStroke, tsh: l.textShadow, g: l.glow,
    mw: l.maxWidth, r: l.rotation,
  })
}

function stickerLayerHash(l: StickerLayer): string {
  return JSON.stringify({
    t: l.text, fs: l.fontSize, c: l.color, fw: l.fontWeight,
    fst: l.fontStyle, w: l.w, h: l.h, r: l.rotation,
  })
}

function renderTextToCanvas(l: EditorTextLayer): { canvas: HTMLCanvasElement; cx: number; cy: number } {
  const padX = Math.max(PAD, (l.textShadow.blur || 0) + Math.abs(l.textShadow.offsetX) + 20)
  const padY = Math.max(PAD, (l.textShadow.blur || 0) + Math.abs(l.textShadow.offsetY) + 20)
  const w = l.maxWidth + padX * 2
  const fontStyle = l.fontStyle === 'italic' ? 'italic ' : ''
  const fontWeight = l.fontWeight === 'bold' ? 'bold ' : ''
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.font = `${fontStyle}${fontWeight}${l.fontSize}px ${l.fontFamily}`
  const lines = wrapText(ctx, l.text, l.maxWidth)
  const lineH = l.fontSize * 1.15
  const textH = lines.length * lineH
  const h = textH + padY * 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w); canvas.height = Math.ceil(h)
  const c2 = canvas.getContext('2d')!
  c2.translate(padX + l.maxWidth / 2 - l.x, padY + textH / 2 - l.y)
  drawLayer(c2, l)
  return { canvas, cx: padX + l.x, cy: padY + l.y }
}

function renderStickerToCanvas(l: StickerLayer): { canvas: HTMLCanvasElement; cx: number; cy: number } {
  const pad = PAD
  const w = l.w + pad * 2
  const h = l.h + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w); canvas.height = Math.ceil(h)
  const ctx = canvas.getContext('2d')!
  ctx.translate(pad + l.w / 2 - l.x, pad + l.h / 2 - l.y)
  drawLayer(ctx, l)
  return { canvas, cx: pad + l.x, cy: pad + l.y }
}

export class PixiEditorRenderer {
  private app: Application | null = null
  private worldContainer: Container | null = null
  private layerContainer: Container | null = null
  private checkerboard: TilingSprite | null = null
  private bgRect: Graphics | null = null
  private bgGradient: Sprite | null = null
  private bgImage: Sprite | null = null
  private layerNodes = new Map<string, Container>()
  private textTextureCache = new Map<string, { texture: Texture; hash: string }>()
  private checkerTexture: Texture | null = null
  private ready = false

  get isReady(): boolean { return this.ready }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.ready) this.destroy()

    this.app = new Application()
    await this.app.init({
      canvas,
      background: 0xffffff,
      antialias: true,
      autoDensity: false,
      resolution: 1,
      width: canvas.clientWidth || 1920,
      height: canvas.clientHeight || 1080,
      preference: 'webgl',
    })

    this.worldContainer = new Container()
    this.layerContainer = new Container()
    this.worldContainer.addChild(this.layerContainer)
    this.app.stage.addChild(this.worldContainer)

    this.checkerTexture = makeCheckerboardTexture()
    this.checkerboard = new TilingSprite({
      texture: this.checkerTexture,
      width: 1920,
      height: 1080,
    })
    this.worldContainer.addChildAt(this.checkerboard, 0)

    this.bgRect = new Graphics()
    this.worldContainer.addChildAt(this.bgRect, 1)

    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'

    this.ready = true
  }

  setViewport(scale: number, panX: number, panY: number): void {
    if (!this.worldContainer) return
    this.worldContainer.scale.set(scale)
    this.worldContainer.position.set(panX, panY)
  }

  resize(width: number, height: number): void {
    if (!this.app) return
    this.app.renderer.resize(width, height)
    if (this.app.canvas) {
      this.app.canvas.style.width = '100%'
      this.app.canvas.style.height = '100%'
    }
  }

  sync(state: PixiRenderState): void {
    if (!this.ready || !this.worldContainer || !this.layerContainer) return
    const { width: cw, height: ch } = state.canvasSize

    if (this.checkerboard) {
      this.checkerboard.width = cw
      this.checkerboard.height = ch
    }

    this.syncBackground(state, cw, ch)

    const allLayers = state.previewLayer
      ? [...state.layers, state.previewLayer]
      : state.layers

    const seen = new Set<string>()
    for (const layer of allLayers) {
      if (!layer.visible) continue
      if (layer.id === state.hideLayerId) continue
      seen.add(layer.id)
      let node = this.layerNodes.get(layer.id)
      if (!node) {
        node = new Container()
        this.layerContainer.addChild(node)
        this.layerNodes.set(layer.id, node)
      }
      this.syncLayerNode(node, layer, state.layerImages)
    }
    for (const [id, node] of this.layerNodes) {
      if (!seen.has(id)) {
        this.layerContainer.removeChild(node)
        this.destroyLayerNode(node, id)
        this.layerNodes.delete(id)
      }
    }

    const orderedIds = allLayers
      .filter(l => l.visible && l.id !== state.hideLayerId)
      .map(l => l.id)
    for (let i = 0; i < orderedIds.length; i++) {
      const node = this.layerNodes.get(orderedIds[i]!)
      if (node) this.layerContainer.setChildIndex(node, i)
    }
  }

  private syncBackground(state: PixiRenderState, cw: number, ch: number): void {
    const { bgColor, sourceImg, imgOffset, imgAlpha } = state

    if (this.checkerboard) {
      this.checkerboard.width = cw
      this.checkerboard.height = ch
    }

    if (this.bgRect) {
      this.bgRect.clear()
      if (bgColor !== 'transparent') {
        const isGradient = bgColor.startsWith('gradient:') || bgColor.startsWith('linear-gradient') || bgColor.startsWith('radial-gradient')
        if (!isGradient) {
          this.bgRect.rect(0, 0, cw, ch).fill(bgColor)
        }
      }
    }

    if (this.bgGradient) {
      this.worldContainer!.removeChild(this.bgGradient)
      this.bgGradient.destroy()
      this.bgGradient = null
    }
    if (bgColor !== 'transparent' && (bgColor.startsWith('gradient:') || bgColor.startsWith('linear-gradient'))) {
      const tex = makeGradientTexture(bgColor, cw, ch)
      this.bgGradient = new Sprite(tex)
      this.worldContainer!.addChildAt(this.bgGradient, 1)
      this.worldContainer!.setChildIndex(this.bgRect!, 0)
      if (this.checkerboard) this.worldContainer!.setChildIndex(this.checkerboard, 0)
    }

    if (this.bgImage) {
      this.worldContainer!.removeChild(this.bgImage)
      this.bgImage.destroy()
      this.bgImage = null
    }
    if (sourceImg) {
      const tex = Texture.from(sourceImg)
      this.bgImage = new Sprite(tex)
      this.bgImage.position.set(imgOffset.x, imgOffset.y)
      this.bgImage.alpha = imgAlpha / 100
      const idx = this.bgGradient ? 2 : 1
      this.worldContainer!.addChildAt(this.bgImage, idx)
    }
  }

  private syncLayerNode(node: Container, layer: EditorLayer, layerImages: Map<string, HTMLImageElement>): void {
    node.removeChildren().forEach(c => c.destroy())
    node.pivot.set(0, 0)
    node.position.set(0, 0)
    node.rotation = 0

    switch (layer.type) {
      case 'arrow': this.drawArrowLayer(node, layer); break
      case 'rect': this.drawRectLayer(node, layer); break
      case 'ellipse': this.drawEllipseLayer(node, layer); break
      case 'highlight': this.drawHighlightLayer(node, layer); break
      case 'freehand': this.drawFreehandLayer(node, layer); break
      case 'text': this.drawTextLayer(node, layer); break
      case 'sticker': this.drawStickerLayer(node, layer); break
      case 'image': this.drawImageLayer(node, layer, layerImages); break
      case 'mosaic': this.drawMosaicLayer(node, layer); break
    }
  }

  private setRotation(node: Container, cx: number, cy: number, rotation: number): void {
    if (rotation) {
      node.pivot.set(cx, cy)
      node.position.set(cx, cy)
      node.rotation = (rotation * Math.PI) / 180
    }
  }

  private drawArrowLayer(node: Container, l: ArrowLayer): void {
    const g = new Graphics()
    const cx = (l.x1 + l.x2) / 2, cy = (l.y1 + l.y2) / 2
    const angle = Math.atan2(l.y2 - l.y1, l.x2 - l.x1)
    const headLen = Math.max(l.lineWidth * 4, 12)
    const headW = headLen * 0.5
    const baseX = l.x2 - headLen * Math.cos(angle)
    const baseY = l.y2 - headLen * Math.sin(angle)

    g.moveTo(l.x1, l.y1).lineTo(baseX, baseY)
    g.stroke({ color: l.color, width: l.lineWidth, cap: 'round', join: 'round' })
    g.moveTo(l.x2, l.y2)
      .lineTo(baseX + headW * Math.sin(angle), baseY - headW * Math.cos(angle))
      .lineTo(baseX - headW * Math.sin(angle), baseY + headW * Math.cos(angle))
      .closePath()
    g.fill(l.color)

    node.addChild(g)
    this.setRotation(node, cx, cy, l.rotation)
  }

  private drawRectLayer(node: Container, l: RectLayer): void {
    const g = new Graphics()
    g.rect(l.x, l.y, l.w, l.h)
    g.stroke({ color: l.color, width: l.lineWidth, cap: 'round', join: 'round' })
    node.addChild(g)
  }

  private drawEllipseLayer(node: Container, l: EllipseLayer): void {
    if (l.rx <= 0 || l.ry <= 0) return
    const g = new Graphics()
    g.ellipse(l.cx, l.cy, l.rx, l.ry)
    g.stroke({ color: l.color, width: l.lineWidth })
    node.addChild(g)
  }

  private drawHighlightLayer(node: Container, l: HighlightLayer): void {
    const g = new Graphics()
    g.rect(l.x, l.y, l.w, l.h)
    const num = colorToNumber(l.color)
    g.fill(num != null ? num : l.color)
    g.alpha = 0.35
    node.addChild(g)
  }

  private drawFreehandLayer(node: Container, l: FreehandLayer): void {
    if (l.points.length < 2) return
    const g = new Graphics()
    g.moveTo(l.points[0]!.x, l.points[0]!.y)
    for (let i = 1; i < l.points.length - 1; i++) {
      const curr = l.points[i]!
      const next = l.points[i + 1]!
      const midX = (curr.x + next.x) / 2
      const midY = (curr.y + next.y) / 2
      g.quadraticCurveTo(curr.x, curr.y, midX, midY)
    }
    const last = l.points[l.points.length - 1]!
    g.lineTo(last.x, last.y)
    g.stroke({ color: l.color, width: l.lineWidth, cap: 'round', join: 'round' })
    node.addChild(g)
  }

  private drawTextLayer(node: Container, l: EditorTextLayer): void {
    if (!l.text) return
    const hash = textLayerHash(l)
    let cached = this.textTextureCache.get(l.id)
    if (!cached || cached.hash !== hash) {
      const { canvas, cx, cy } = renderTextToCanvas(l)
      const texture = Texture.from(canvas)
      cached = { texture, hash }
      this.textTextureCache.set(l.id, cached)
      void cx; void cy
    }
    const sprite = new Sprite(cached.texture)
    const bounds = getEditorLayerBounds(l)
    sprite.position.set(bounds.x - PAD, bounds.y - PAD)
    node.addChild(sprite)
    this.setRotation(node, l.x, l.y, l.rotation)
  }

  private drawStickerLayer(node: Container, l: StickerLayer): void {
    const hash = stickerLayerHash(l)
    let cached = this.textTextureCache.get(l.id)
    if (!cached || cached.hash !== hash) {
      const { canvas } = renderStickerToCanvas(l)
      const texture = Texture.from(canvas)
      cached = { texture, hash }
      this.textTextureCache.set(l.id, cached)
    }
    const sprite = new Sprite(cached.texture)
    sprite.position.set(l.x - l.w / 2 - PAD, l.y - l.h / 2 - PAD)
    node.addChild(sprite)
    this.setRotation(node, l.x, l.y, l.rotation)
  }

  private drawImageLayer(node: Container, l: EditorImageLayer, layerImages: Map<string, HTMLImageElement>): void {
    const img = layerImages.get(l.id)
    if (!img) return
    const tex = Texture.from(img)
    const sprite = new Sprite(tex)
    sprite.anchor.set(0.5)
    sprite.position.set(l.x, l.y)
    sprite.width = l.w
    sprite.height = l.h
    sprite.alpha = l.opacity
    node.addChild(sprite)
    this.setRotation(node, l.x, l.y, l.rotation)
  }

  private drawMosaicLayer(node: Container, l: import('../utils/types').MosaicLayer): void {
    const g = new Graphics()
    g.rect(l.x, l.y, l.w, l.h)
    g.fill({ color: 0x888888, alpha: 0.6 })
    node.addChild(g)
  }

  private destroyLayerNode(node: Container, id: string): void {
    node.removeChildren().forEach(c => c.destroy())
    node.destroy()
    const cached = this.textTextureCache.get(id)
    if (cached) {
      cached.texture.destroy(true)
      this.textTextureCache.delete(id)
    }
  }

  destroy(): void {
    for (const [id, node] of this.layerNodes) {
      this.destroyLayerNode(node, id)
    }
    this.layerNodes.clear()
    this.textTextureCache.clear()
    this.checkerTexture?.destroy(true)
    this.checkerTexture = null
    this.app?.destroy(true)
    this.app = null
    this.ready = false
  }
}
