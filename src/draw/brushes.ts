import type { BgId, Pt } from './types'
import { tint } from './shapes'

type XY = { x: number; y: number }

/** Points along a quadratic curve a -> (ctrl c) -> b, roughly `step` px apart (excluding a). */
export function sampleQuad(a: XY, c: XY, b: XY, step: number): XY[] {
  const len = Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y)
  const n = Math.max(1, Math.ceil(len / Math.max(0.5, step)))
  const out: XY[] = []
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const mt = 1 - t
    out.push({
      x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x,
      y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y,
    })
  }
  return out
}

export function quadLength(a: XY, c: XY, b: XY): number {
  return (Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y) + Math.hypot(b.x - a.x, b.y - a.y)) / 2
}

export function strokeQuad(ctx: CanvasRenderingContext2D, a: XY, c: XY, b: XY, width: number, style: string) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(0.5, width)
  ctx.strokeStyle = style
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.quadraticCurveTo(c.x, c.y, b.x, b.y)
  ctx.stroke()
}

export function dot(ctx: CanvasRenderingContext2D, p: XY, r: number, style: string) {
  ctx.fillStyle = style
  ctx.beginPath()
  ctx.arc(p.x, p.y, Math.max(0.5, r), 0, Math.PI * 2)
  ctx.fill()
}

function randInDisk(r: number): XY {
  const a = Math.random() * Math.PI * 2
  const d = Math.sqrt(Math.random()) * r
  return { x: Math.cos(a) * d, y: Math.sin(a) * d }
}

/** Crayon / pencil: grainy dots scattered inside the brush radius. */
export function crayonAt(ctx: CanvasRenderingContext2D, p: XY, r: number, grain: number, color: string) {
  ctx.fillStyle = color
  const n = Math.min(60, Math.max(3, Math.round(r * 1.3)))
  for (let i = 0; i < n; i++) {
    const o = randInDisk(r)
    ctx.globalAlpha = 0.25 + Math.random() * 0.6
    ctx.fillRect(p.x + o.x, p.y + o.y, grain, grain)
  }
  ctx.globalAlpha = 1
}

/** Spray paint: a mist of tiny dots. */
export function sprayAt(ctx: CanvasRenderingContext2D, p: XY, r: number, dotR: number, color: string, count: number) {
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const o = randInDisk(r)
    ctx.beginPath()
    ctx.arc(p.x + o.x, p.y + o.y, dotR * (0.6 + Math.random() * 0.8), 0, Math.PI * 2)
    ctx.fill()
  }
}

function starShape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45
    const a = rot + (i * Math.PI) / 5
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

function twinkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const k = r * 0.18
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x + k, y - k, x + r, y)
  ctx.quadraticCurveTo(x + k, y + k, x, y + r)
  ctx.quadraticCurveTo(x - k, y + k, x - r, y)
  ctx.quadraticCurveTo(x - k, y - k, x, y - r)
  ctx.closePath()
  ctx.fill()
}

/** Glitter: a random little star, twinkle or dot near p. */
export function sparkleAt(ctx: CanvasRenderingContext2D, p: XY, spread: number, baseR: number, color: string) {
  const o = randInDisk(spread)
  const roll = Math.random()
  ctx.fillStyle =
    roll < 0.5 ? color : roll < 0.75 ? tint(color, 0.55) : roll < 0.9 ? '#ffd84d' : '#ffffff'
  const r = baseR * (0.5 + Math.random() * 0.9)
  const kind = Math.random()
  if (kind < 0.35) starShape(ctx, p.x + o.x, p.y + o.y, r, Math.random() * Math.PI)
  else if (kind < 0.65) twinkle(ctx, p.x + o.x, p.y + o.y, r * 1.1)
  else dot(ctx, { x: p.x + o.x, y: p.y + o.y }, r * 0.4, ctx.fillStyle as string)
}

export function pressureOf(e: PointerEvent): number {
  if (e.pointerType !== 'pen') return 1
  const pr = e.pressure > 0 ? e.pressure : 0.5
  return Math.min(1.25, 0.3 + pr * 0.95)
}

export function toPt(e: PointerEvent, rect: DOMRect, w: number, h: number): Pt {
  return {
    x: ((e.clientX - rect.left) / rect.width) * w,
    y: ((e.clientY - rect.top) / rect.height) * h,
    p: pressureOf(e),
  }
}

/* ---------- backgrounds ---------- */

export const BACKGROUNDS: { id: BgId; label: string; swatch: string }[] = [
  { id: 'white', label: 'White', swatch: '#ffffff' },
  { id: 'paper', label: 'Paper', swatch: '#fbf3e2' },
  { id: 'sky', label: 'Sky', swatch: '#cfeeff' },
  { id: 'grid', label: 'Grid', swatch: '#ffffff' },
  { id: 'lines', label: 'Lines', swatch: '#fffdf6' },
  { id: 'dark', label: 'Night', swatch: '#232a5c' },
]

export function isDarkBg(bg: BgId) {
  return bg === 'dark'
}

/** Deterministic pseudo random so the paper/clouds look the same every time. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.arc(x, y, s, 0, Math.PI * 2)
  ctx.arc(x + s * 1.1, y - s * 0.5, s * 1.25, 0, Math.PI * 2)
  ctx.arc(x + s * 2.3, y, s * 0.95, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(x, y, s * 2.3, s * 0.95)
}

export function paintBackground(ctx: CanvasRenderingContext2D, bg: BgId, w: number, h: number) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const sw = BACKGROUNDS.find((b) => b.id === bg)?.swatch ?? '#ffffff'
  ctx.fillStyle = sw
  ctx.fillRect(0, 0, w, h)
  const k = w / 800
  if (bg === 'paper') {
    const rnd = seeded(7)
    ctx.fillStyle = '#efe2c4'
    for (let i = 0; i < 900; i++) {
      ctx.globalAlpha = 0.35 + rnd() * 0.5
      ctx.fillRect(rnd() * w, rnd() * h, (1 + rnd() * 2.5) * k, (0.6 + rnd()) * k)
    }
    ctx.globalAlpha = 1
  } else if (bg === 'sky') {
    ctx.fillStyle = '#ffffff'
    cloud(ctx, w * 0.1, h * 0.16, 26 * k)
    cloud(ctx, w * 0.68, h * 0.1, 20 * k)
    cloud(ctx, w * 0.42, h * 0.28, 14 * k)
  } else if (bg === 'grid') {
    ctx.strokeStyle = '#d4e8f7'
    ctx.lineWidth = Math.max(1, 1.2 * k)
    const step = w / 24
    ctx.beginPath()
    for (let x = step; x < w; x += step) {
      ctx.moveTo(Math.round(x) + 0.5, 0)
      ctx.lineTo(Math.round(x) + 0.5, h)
    }
    for (let y = step; y < h; y += step) {
      ctx.moveTo(0, Math.round(y) + 0.5)
      ctx.lineTo(w, Math.round(y) + 0.5)
    }
    ctx.stroke()
  } else if (bg === 'lines') {
    ctx.strokeStyle = '#bfe0f5'
    ctx.lineWidth = Math.max(1, 1.6 * k)
    const step = h / 14
    ctx.beginPath()
    for (let y = step * 1.5; y < h; y += step) {
      ctx.moveTo(0, Math.round(y))
      ctx.lineTo(w, Math.round(y))
    }
    ctx.stroke()
    ctx.strokeStyle = '#ffb3c9'
    ctx.beginPath()
    ctx.moveTo(Math.round(w * 0.1), 0)
    ctx.lineTo(Math.round(w * 0.1), h)
    ctx.stroke()
  } else if (bg === 'dark') {
    const rnd = seeded(42)
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.25 + rnd() * 0.45
      ctx.beginPath()
      ctx.arc(rnd() * w, rnd() * h, (0.6 + rnd() * 1.3) * k, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()
}
