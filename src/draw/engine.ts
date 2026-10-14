import type { BgId, EngineSettings, EngineState, Pt, TemplateId, ToolId } from './types'
import { crayonAt, dot, isDarkBg, paintBackground, quadLength, sampleQuad, sparkleAt, sprayAt, strokeQuad } from './brushes'
import { drawShape, drawTemplate, parseColor } from './shapes'
import { floodFill } from './fill'

type Entry = { img: ImageData; tpl: TemplateId | null }
type Mat = [number, number, number, number, number, number]

/** Tools that paint into the live layer first, then get composited with opacity. */
const LIVE_TOOLS: ToolId[] = ['pen', 'marker', 'crayon', 'rainbow', 'glitter', 'spray']

type Stroke = {
  tool: ToolId
  color: string
  alpha: number
  size: number
  pointerId: number
  pointerType: string
  prev: Pt
  mid: Pt
  pw: number
  hue: number
  acc: number
  raf: number
  live: boolean
}

export type Layers = { bg: HTMLCanvasElement; ink: HTMLCanvasElement; live: HTMLCanvasElement; line: HTMLCanvasElement }

function ctx2d(c: HTMLCanvasElement, willRead = false): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', willRead ? { willReadFrequently: true } : undefined)
  if (!ctx) throw new Error('Canvas not supported')
  return ctx
}

export class DrawEngine {
  readonly w: number
  readonly h: number
  /** internal px per "reference" px (canvas designed around 800 wide) */
  readonly k: number
  private bg: CanvasRenderingContext2D
  private ink: CanvasRenderingContext2D
  private live: CanvasRenderingContext2D
  private line: CanvasRenderingContext2D
  private layers: Layers
  bgId: BgId = 'white'
  tpl: TemplateId | null = null
  private undoStack: Entry[] = []
  private redoStack: Entry[] = []
  private maxUndo: number
  private stroke: Stroke | null = null

  onState: (s: EngineState) => void = () => {}
  /** Fired after anything changed the drawing (for draft saving). */
  onCommit: () => void = () => {}
  onText: (p: Pt) => void = () => {}

  constructor(layers: Layers, w: number, h: number, private getSettings: () => EngineSettings) {
    this.layers = layers
    this.w = w
    this.h = h
    this.k = w / 800
    for (const c of Object.values(layers)) {
      c.width = w
      c.height = h
    }
    this.bg = ctx2d(layers.bg)
    this.ink = ctx2d(layers.ink, true)
    this.live = ctx2d(layers.live)
    this.line = ctx2d(layers.line, true)
    const bytes = w * h * 4
    this.maxUndo = Math.max(10, Math.min(30, Math.floor(170e6 / bytes)))
    paintBackground(this.bg, this.bgId, w, h)
  }

  /* ---------------- state ---------------- */

  private emit() {
    this.onState({ canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0, template: this.tpl })
  }

  private snapshot(): Entry {
    return { img: this.ink.getImageData(0, 0, this.w, this.h), tpl: this.tpl }
  }

  private pushUndo(entry: Entry = this.snapshot()) {
    this.undoStack.push(entry)
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift()
    this.redoStack = []
  }

  private restore(e: Entry) {
    this.ink.putImageData(e.img, 0, 0)
    if (e.tpl !== this.tpl) {
      this.tpl = e.tpl
      this.renderLine()
    }
  }

  undo() {
    this.cancelStroke(false)
    const e = this.undoStack.pop()
    if (!e) return
    this.redoStack.push(this.snapshot())
    this.restore(e)
    this.emit()
    this.onCommit()
  }

  redo() {
    this.cancelStroke(false)
    const e = this.redoStack.pop()
    if (!e) return
    this.undoStack.push(this.snapshot())
    this.restore(e)
    this.emit()
    this.onCommit()
  }

  clear() {
    this.cancelStroke(false)
    this.pushUndo()
    this.ink.clearRect(0, 0, this.w, this.h)
    this.emit()
    this.onCommit()
  }

  setBackground(bg: BgId) {
    const wasDark = isDarkBg(this.bgId)
    this.bgId = bg
    paintBackground(this.bg, bg, this.w, this.h)
    if (wasDark !== isDarkBg(bg)) this.renderLine()
    this.onCommit()
  }

  /** Load a coloring page (clears the drawing; undoable). Pass null to remove the outline. */
  setTemplate(id: TemplateId | null, clearInk = true) {
    this.cancelStroke(false)
    this.pushUndo()
    if (clearInk) this.ink.clearRect(0, 0, this.w, this.h)
    this.tpl = id
    this.renderLine()
    this.emit()
    this.onCommit()
  }

  private renderLine() {
    this.line.clearRect(0, 0, this.w, this.h)
    if (this.tpl) drawTemplate(this.line, this.tpl, this.w, this.h, isDarkBg(this.bgId) ? '#f4f4ff' : '#2b2b3a')
  }

  /** Replace the drawing with an image (draft / gallery). Not undoable when `record` is false. */
  async loadInk(src: string | Blob, opts: { bg?: BgId; tpl?: TemplateId | null; record?: boolean } = {}) {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = () => reject(new Error('image load failed'))
        im.src = url
      })
      this.cancelStroke(false)
      if (opts.record) this.pushUndo()
      this.ink.clearRect(0, 0, this.w, this.h)
      this.ink.drawImage(img, 0, 0, this.w, this.h)
      if (opts.tpl !== undefined) {
        this.tpl = opts.tpl
        this.renderLine()
      }
      if (opts.bg) {
        this.bgId = opts.bg
        paintBackground(this.bg, opts.bg, this.w, this.h)
        this.renderLine()
      }
      this.emit()
    } finally {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
    }
  }

  inkDataURL(scale = 1): string {
    if (scale >= 1) return this.layers.ink.toDataURL('image/png')
    const c = document.createElement('canvas')
    c.width = Math.round(this.w * scale)
    c.height = Math.round(this.h * scale)
    ctx2d(c).drawImage(this.layers.ink, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  }

  inkBlob(): Promise<Blob> {
    return toBlob(this.layers.ink, 'image/png')
  }

  /** Flattened copy (background + drawing + outline) scaled so the long side <= maxSide. */
  flatten(maxSide: number): HTMLCanvasElement {
    const s = Math.min(1, maxSide / Math.max(this.w, this.h))
    const c = document.createElement('canvas')
    c.width = Math.round(this.w * s)
    c.height = Math.round(this.h * s)
    const ctx = ctx2d(c)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(this.layers.bg, 0, 0, c.width, c.height)
    ctx.drawImage(this.layers.ink, 0, 0, c.width, c.height)
    ctx.drawImage(this.layers.line, 0, 0, c.width, c.height)
    return c
  }

  exportJpeg(maxSide = 1600, quality = 0.9): Promise<Blob> {
    return toBlob(this.flatten(maxSide), 'image/jpeg', quality)
  }

  isBlank(): boolean {
    if (this.tpl) return false
    const d = this.ink.getImageData(0, 0, this.w, this.h).data
    for (let i = 3; i < d.length; i += 16) if (d[i] > 0) return false
    return true
  }

  /* ---------------- symmetry ---------------- */

  private mats(): Mat[] {
    const { symmetry } = this.getSettings()
    const id: Mat = [1, 0, 0, 1, 0, 0]
    if (symmetry === 'off') return [id]
    const fx: Mat = [-1, 0, 0, 1, this.w, 0]
    if (symmetry === 'mirror') return [id, fx]
    return [id, fx, [1, 0, 0, -1, 0, this.h], [-1, 0, 0, -1, this.w, this.h]]
  }

  private mirrorPoints(p: Pt): Pt[] {
    return this.mats().map(([a, , , d, e, f]) => ({ x: a * p.x + e, y: d * p.y + f, p: p.p }))
  }

  private each(ctx: CanvasRenderingContext2D, fn: () => void) {
    for (const m of this.mats()) {
      ctx.setTransform(...m)
      fn()
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  /* ---------------- pointer input ---------------- */

  get drawing() {
    return this.stroke !== null
  }

  get activePointer() {
    return this.stroke?.pointerId ?? null
  }

  get activePointerType() {
    return this.stroke?.pointerType ?? null
  }

  begin(pt: Pt, pointerId: number, pointerType: string) {
    const s = this.getSettings()
    if (s.tool === 'fill') return this.fillAt(pt)
    if (s.tool === 'text') return this.onText(pt)
    this.pushUndo()

    const live = LIVE_TOOLS.includes(s.tool)
    const alpha = s.tool === 'marker' ? s.opacity * 0.55 : s.opacity
    this.stroke = {
      tool: s.tool,
      color: s.color,
      alpha,
      size: s.size * this.k,
      pointerId,
      pointerType,
      prev: pt,
      mid: pt,
      pw: pt.p,
      hue: Math.random() * 360,
      acc: 0,
      raf: 0,
      live,
    }
    if (live) {
      this.live.clearRect(0, 0, this.w, this.h)
      this.layers.live.style.opacity = String(alpha)
    }
    if (s.tool === 'shape' || s.tool === 'sticker') {
      this.stamp(pt)
      return
    }
    this.dab(pt)
    if (s.tool === 'spray') this.sprayLoop()
  }

  move(pts: Pt[]) {
    const st = this.stroke
    if (!st) return
    for (const pt of pts) {
      const d = Math.hypot(pt.x - st.prev.x, pt.y - st.prev.y)
      if (d < 0.8 * this.k) continue
      if (st.tool === 'shape' || st.tool === 'sticker') {
        st.acc += d
        st.prev = pt
        if (st.acc >= this.stampSize() * 0.9) {
          st.acc = 0
          this.stamp(pt)
        }
        continue
      }
      const mid: Pt = { x: (st.prev.x + pt.x) / 2, y: (st.prev.y + pt.y) / 2, p: pt.p }
      st.pw = st.pw * 0.6 + pt.p * 0.4
      this.segment(st.mid, st.prev, mid)
      st.mid = mid
      st.prev = pt
    }
  }

  end() {
    const st = this.stroke
    if (!st) return
    if (st.tool !== 'shape' && st.tool !== 'sticker') this.segment(st.mid, st.prev, st.prev)
    cancelAnimationFrame(st.raf)
    if (st.live) {
      this.ink.globalAlpha = st.alpha
      this.ink.drawImage(this.layers.live, 0, 0)
      this.ink.globalAlpha = 1
      this.live.clearRect(0, 0, this.w, this.h)
    }
    this.stroke = null
    this.emit()
    this.onCommit()
  }

  /** Abort the current stroke. With `revert`, the drawing goes back to before it started (palm rejection). */
  cancelStroke(revert = true) {
    const st = this.stroke
    if (!st) return
    cancelAnimationFrame(st.raf)
    this.live.clearRect(0, 0, this.w, this.h)
    this.stroke = null
    if (revert) {
      const e = this.undoStack.pop()
      if (e) this.restore(e)
    } else if (st.live) {
      // keep what was drawn
      this.ink.globalAlpha = st.alpha
      this.ink.drawImage(this.layers.live, 0, 0)
      this.ink.globalAlpha = 1
    }
    this.emit()
  }

  /* ---------------- painting ---------------- */

  private width(st: Stroke): number {
    switch (st.tool) {
      case 'marker':
        return st.size * 1.7 * (0.8 + 0.2 * st.pw)
      case 'eraser':
        return st.size * 1.8 * (0.7 + 0.3 * st.pw)
      default:
        return st.size * st.pw
    }
  }

  private target(st: Stroke) {
    return st.live ? this.live : this.ink
  }

  private dab(p: Pt) {
    const st = this.stroke!
    const ctx = this.target(st)
    if (st.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out'
    this.each(ctx, () => {
      switch (st.tool) {
        case 'crayon':
          crayonAt(ctx, p, (st.size * st.pw) / 2 + this.k, this.grain(), st.color)
          break
        case 'glitter':
          sparkleAt(ctx, p, st.size * 0.9, this.sparkleR(st), st.color)
          break
        case 'spray':
          sprayAt(ctx, p, st.size * 1.6, this.sprayDot(st), st.color, this.sprayCount(st))
          break
        case 'rainbow':
          dot(ctx, p, this.width(st) / 2, `hsl(${st.hue % 360},90%,60%)`)
          break
        default:
          dot(ctx, p, this.width(st) / 2, st.tool === 'eraser' ? '#000' : st.color)
      }
    })
    ctx.globalCompositeOperation = 'source-over'
  }

  private grain() {
    return Math.max(1, 1.3 * this.k)
  }
  private sparkleR(st: Stroke) {
    return Math.max(3 * this.k, st.size * 0.45)
  }
  private sprayDot(st: Stroke) {
    return Math.max(0.6 * this.k, st.size * 0.035)
  }
  private sprayCount(st: Stroke) {
    return Math.round(Math.min(45, Math.max(6, st.size / this.k)))
  }

  private segment(a: Pt, c: Pt, b: Pt) {
    const st = this.stroke!
    const ctx = this.target(st)
    const len = quadLength(a, c, b)
    switch (st.tool) {
      case 'pen':
      case 'marker': {
        const wd = this.width(st)
        this.each(ctx, () => strokeQuad(ctx, a, c, b, wd, st.color))
        break
      }
      case 'eraser': {
        const wd = this.width(st)
        ctx.globalCompositeOperation = 'destination-out'
        this.each(ctx, () => strokeQuad(ctx, a, c, b, wd, '#000'))
        ctx.globalCompositeOperation = 'source-over'
        break
      }
      case 'rainbow': {
        const wd = this.width(st)
        const style = `hsl(${st.hue % 360},90%,60%)`
        this.each(ctx, () => strokeQuad(ctx, a, c, b, wd, style))
        st.hue += len * (0.9 / this.k)
        break
      }
      case 'crayon': {
        const r = (st.size * st.pw) / 2 + this.k
        const pts = sampleQuad(a, c, b, Math.max(this.k, r * 0.3))
        this.each(ctx, () => {
          for (const p of pts) crayonAt(ctx, p, r, this.grain(), st.color)
        })
        break
      }
      case 'glitter': {
        st.acc += len
        const spacing = Math.max(3 * this.k, st.size * 0.35)
        if (st.acc < spacing) break
        const pts = sampleQuad(a, c, b, spacing)
        st.acc = 0
        this.each(ctx, () => {
          for (const p of pts) sparkleAt(ctx, p, st.size * 0.9, this.sparkleR(st), st.color)
        })
        break
      }
      case 'spray': {
        const pts = sampleQuad(a, c, b, Math.max(2 * this.k, st.size * 0.5))
        const n = Math.max(2, Math.round(this.sprayCount(st) / 3))
        this.each(ctx, () => {
          for (const p of pts) sprayAt(ctx, p, st.size * 1.6, this.sprayDot(st), st.color, n)
        })
        break
      }
      default:
        break
    }
  }

  /** Spray keeps misting while the finger rests. */
  private sprayLoop() {
    const tick = () => {
      const st = this.stroke
      if (!st || st.tool !== 'spray') return
      const p = st.prev
      this.each(this.live, () =>
        sprayAt(this.live, p, st.size * 1.6, this.sprayDot(st), st.color, Math.round(this.sprayCount(st) / 2)),
      )
      st.raf = requestAnimationFrame(tick)
    }
    this.stroke!.raf = requestAnimationFrame(tick)
  }

  stampSize(): number {
    const s = this.getSettings()
    return (22 + s.size * 2.4) * this.k
  }

  private stamp(p: Pt) {
    const s = this.getSettings()
    const size = this.stampSize()
    const ctx = this.ink
    ctx.globalAlpha = s.opacity
    for (const q of this.mirrorPoints(p)) {
      const rot = (Math.random() - 0.5) * 0.4
      if (s.tool === 'shape') {
        drawShape(ctx, s.shape, q.x, q.y, size, s.color, rot)
      } else {
        ctx.save()
        ctx.translate(q.x, q.y)
        ctx.rotate(rot)
        ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(s.sticker, 0, size * 0.04)
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1
  }

  fillAt(pt: Pt) {
    const s = this.getSettings()
    const before = this.snapshot()
    const img = new ImageData(new Uint8ClampedArray(before.img.data), this.w, this.h)
    let wall: Uint8Array | null = null
    if (this.tpl) {
      const ld = this.line.getImageData(0, 0, this.w, this.h).data
      wall = new Uint8Array(this.w * this.h)
      for (let i = 0; i < wall.length; i++) wall[i] = ld[i * 4 + 3] > 70 ? 1 : 0
    }
    const rgb = parseColor(s.color)
    let painted = false
    for (const q of this.mirrorPoints(pt)) {
      if (floodFill(img, wall, q.x, q.y, rgb, s.opacity)) painted = true
    }
    if (!painted) return
    this.pushUndo(before)
    this.ink.putImageData(img, 0, 0)
    this.emit()
    this.onCommit()
  }

  placeText(pt: Pt, text: string) {
    const s = this.getSettings()
    const t = text.trim()
    if (!t) return
    this.pushUndo()
    const px = Math.round((14 + s.size * 1.5) * this.k)
    const ctx = this.ink
    ctx.save()
    ctx.globalAlpha = s.opacity
    ctx.font = `600 ${px}px Fredoka, "Chalkboard SE", "Comic Sans MS", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = s.color
    const lines = t.split('\n')
    lines.forEach((ln, i) => ctx.fillText(ln, pt.x, pt.y + (i - (lines.length - 1) / 2) * px * 1.15))
    ctx.restore()
    this.emit()
    this.onCommit()
  }
}

export function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const fallback = () => {
      try {
        const url = c.toDataURL(type, quality)
        const bin = atob(url.split(',')[1])
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        resolve(new Blob([arr], { type }))
      } catch (err) {
        reject(err)
      }
    }
    try {
      c.toBlob((b) => (b ? resolve(b) : fallback()), type, quality)
    } catch {
      fallback()
    }
  })
}
