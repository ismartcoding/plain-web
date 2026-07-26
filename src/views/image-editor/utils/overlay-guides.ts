/**
 * Draw distance guide lines + labels on a canvas context.
 * Shared by ImageEditor and MakerEditor overlay rendering.
 */

const GUIDE_COLOR = '#f0f'
const LABEL_BG = '#f0f'
const LABEL_FG = '#fff'
const MIN_LABEL_PX = 40

function drawLabel(
  ctx: CanvasRenderingContext2D,
  value: number,
  cx: number,
  cy: number,
) {
  const text = String(value)
  ctx.font = 'bold 18px sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  const tw = ctx.measureText(text).width
  const pw = 8
  const ph = 4
  const bw = tw + pw * 2
  const bh = 20 + ph * 2
  const r = 4

  ctx.fillStyle = LABEL_BG
  ctx.beginPath()
  ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, r)
  ctx.fill()

  ctx.fillStyle = LABEL_FG
  ctx.fillText(text, cx, cy)
}

/**
 * Draw distance guide lines from edge of a bounding box to canvas edges.
 * Lines extend horizontally from left/right edges and vertically from top/bottom edges.
 */
export function drawDistanceGuides(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  canvasW: number,
  canvasH: number,
) {
  const bx = bounds.x
  const by = bounds.y
  const br = bounds.x + bounds.w
  const bb = bounds.y + bounds.h
  const midY = by + bounds.h / 2
  const midX = bx + bounds.w / 2

  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = GUIDE_COLOR
  ctx.lineWidth = 1.5

  if (bx > 2) { ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(bx, midY); ctx.stroke() }
  if (canvasW - br > 2) { ctx.beginPath(); ctx.moveTo(br, midY); ctx.lineTo(canvasW, midY); ctx.stroke() }
  if (by > 2) { ctx.beginPath(); ctx.moveTo(midX, 0); ctx.lineTo(midX, by); ctx.stroke() }
  if (canvasH - bb > 2) { ctx.beginPath(); ctx.moveTo(midX, bb); ctx.lineTo(midX, canvasH); ctx.stroke() }

  ctx.setLineDash([])

  const leftPx = Math.round(bx)
  const rightPx = Math.round(canvasW - br)
  const topPx = Math.round(by)
  const bottomPx = Math.round(canvasH - bb)

  if (leftPx > MIN_LABEL_PX) drawLabel(ctx, leftPx, bx / 2, midY)
  if (rightPx > MIN_LABEL_PX) drawLabel(ctx, rightPx, br + (canvasW - br) / 2, midY)
  if (topPx > MIN_LABEL_PX) drawLabel(ctx, topPx, midX, by / 2)
  if (bottomPx > MIN_LABEL_PX) drawLabel(ctx, bottomPx, midX, bb + (canvasH - bb) / 2)

  ctx.restore()
}

const CENTER_LINE_COLOR = '#22c55e'

/**
 * Draw green crosshair lines at the canvas center (50%/50%).
 * Shown during layer drag so users can align layers to the center.
 */
export function drawCenterCrosshair(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
) {
  const cx = canvasW / 2
  const cy = canvasH / 2

  ctx.save()
  ctx.setLineDash([6, 4])
  ctx.strokeStyle = CENTER_LINE_COLOR
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(0, cy)
  ctx.lineTo(canvasW, cy)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, canvasH)
  ctx.stroke()

  ctx.restore()
}
