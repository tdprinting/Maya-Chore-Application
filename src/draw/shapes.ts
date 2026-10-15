import type { ShapeId, TemplateId } from './types'

/* ---------- tiny SVG path builders (shared by canvas + inline SVG icons) ---------- */

const f = (n: number) => Math.round(n * 100) / 100

export function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rotDeg = 0): string {
  const t = (rotDeg * Math.PI) / 180
  const dx = Math.cos(t) * rx
  const dy = Math.sin(t) * rx
  const a = `${f(cx - dx)} ${f(cy - dy)}`
  const b = `${f(cx + dx)} ${f(cy + dy)}`
  return `M${a}A${f(rx)} ${f(ry)} ${f(rotDeg)} 1 0 ${b}A${f(rx)} ${f(ry)} ${f(rotDeg)} 1 0 ${a}Z`
}

export function rect(x: number, y: number, w: number, h: number): string {
  return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`
}

function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${f(h - 2 * r)}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}h${f(-(w - 2 * r))}a${r} ${r} 0 0 1 ${-r} ${-r}v${f(-(h - 2 * r))}` +
    `a${r} ${r} 0 0 1 ${r} ${-r}Z`
  )
}

function starPath(cx: number, cy: number, outer: number, inner: number, points: number, rot = -90): string {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = ((rot + (i * 180) / points) * Math.PI) / 180
    d += `${i === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`
  }
  return d + 'Z'
}

/* ---------- stamp shapes (100 x 100 box, centred on 50,50) ---------- */

export type ShapePart = { d: string; fill: 'color' | 'white' | 'dark' | 'accent' }

export const SHAPES: { id: ShapeId; label: string; parts: ShapePart[] }[] = [
  {
    id: 'heart',
    label: 'Heart',
    parts: [
      {
        d: 'M50 88C20 66 6 50 6 32C6 18 17 8 30 8C39 8 46 13 50 21C54 13 61 8 70 8C83 8 94 18 94 32C94 50 80 66 50 88Z',
        fill: 'color',
      },
    ],
  },
  { id: 'star', label: 'Star', parts: [{ d: starPath(50, 54, 46, 20, 5), fill: 'color' }] },
  {
    id: 'flower',
    label: 'Flower',
    parts: [
      {
        d: [0, 1, 2, 3, 4]
          .map((i) => {
            const a = ((-90 + i * 72) * Math.PI) / 180
            return circle(50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26, 21)
          })
          .join(''),
        fill: 'color',
      },
      { d: circle(50, 50, 15), fill: 'accent' },
    ],
  },
  {
    id: 'cat',
    label: 'Kitty',
    parts: [
      { d: 'M14 46L16 6L42 26ZM86 46L84 6L58 26Z', fill: 'color' },
      { d: ellipse(50, 56, 40, 34), fill: 'color' },
      { d: ellipse(35, 52, 7, 8) + ellipse(65, 52, 7, 8), fill: 'white' },
      { d: circle(36, 54, 3.6) + circle(66, 54, 3.6), fill: 'dark' },
      { d: 'M45 64h10l-5 6Z', fill: 'dark' },
    ],
  },
  { id: 'circle', label: 'Circle', parts: [{ d: circle(50, 50, 44), fill: 'color' }] },
  { id: 'square', label: 'Square', parts: [{ d: roundRect(8, 8, 84, 84, 12), fill: 'color' }] },
  {
    id: 'moon',
    label: 'Moon',
    parts: [{ d: 'M62 6A44 44 0 1 0 94 70A36 36 0 1 1 62 6Z', fill: 'color' }],
  },
  {
    id: 'sparkle',
    label: 'Sparkle',
    parts: [{ d: 'M50 2Q56 44 98 50Q56 56 50 98Q44 56 2 50Q44 44 50 2Z', fill: 'color' }],
  },
]

const pathCache = new Map<string, Path2D>()
export function path2d(d: string): Path2D {
  let p = pathCache.get(d)
  if (!p) {
    p = new Path2D(d)
    pathCache.set(d, p)
  }
  return p
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function parseColor(hex: string): [number, number, number] {
  return hexToRgb(hex)
}

/** Mix a hex colour with white (amt 0..1). */
export function tint(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  const m = (c: number) => Math.round(c + (255 - c) * amt)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

function isYellowish(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex)
  return r > 200 && g > 170 && b < 140
}

export function partFill(part: ShapePart, color: string): string {
  switch (part.fill) {
    case 'color':
      return color
    case 'white':
      return '#ffffff'
    case 'dark':
      return '#2b2b3a'
    case 'accent':
      return isYellowish(color) ? '#ff6fae' : '#ffd84d'
  }
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  id: ShapeId,
  x: number,
  y: number,
  size: number,
  color: string,
  rot = 0,
) {
  const shape = SHAPES.find((s) => s.id === id) ?? SHAPES[0]
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(size / 100, size / 100)
  ctx.translate(-50, -50)
  for (const part of shape.parts) {
    ctx.fillStyle = partFill(part, color)
    ctx.fill(path2d(part.d))
  }
  ctx.restore()
}

/* ---------- coloring page outlines (100 x 75 box) ---------- */

type OutlineOp = {
  d: string
  /** Paths this stroke is hidden behind (so overlapping parts look layered). */
  behind?: string[]
  /** Solid filled detail (eyes, nose...) instead of a stroked outline. */
  solid?: boolean
  /** Thinner detail line. */
  thin?: boolean
}

const sunRays = (cx: number, cy: number, r1: number, r2: number) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    return `M${f(cx + Math.cos(a) * r1)} ${f(cy + Math.sin(a) * r1)}L${f(cx + Math.cos(a) * r2)} ${f(cy + Math.sin(a) * r2)}`
  }).join('')

const catHead = circle(50, 30, 13)
const catBody = ellipse(50, 56, 17, 13.5)
const catPaws = ellipse(43, 69, 5.5, 3.2) + ellipse(57, 69, 5.5, 3.2)

const flowerCenter = circle(50, 26, 6)
const flowerPetals = [0, 1, 2, 3, 4, 5].map((i) => {
  const deg = -90 + i * 60
  const a = (deg * Math.PI) / 180
  return ellipse(50 + Math.cos(a) * 12, 26 + Math.sin(a) * 12, 7.2, 4.8, deg)
})

const fishBody = ellipse(48, 38, 24, 14.5)
const houseRoof = 'M21 37L50 11L79 37Z'
const houseWalls = rect(27, 34, 46, 34)

export const TEMPLATES: { id: TemplateId; label: string; emoji: string; ops: OutlineOp[] }[] = [
  {
    id: 'cat',
    label: 'Kitty',
    emoji: '🐱',
    ops: [
      { d: 'M64 60Q82 62 80 44Q79 38 83 36Q88 38 86 46Q86 68 62 66Z', behind: [catBody] },
      { d: catBody, behind: [catHead, catPaws] },
      { d: catPaws },
      { d: 'M38 24L36 8L47 18Z M62 24L64 8L53 18Z', behind: [catHead] },
      { d: 'M39.5 19L38.5 12L44 17Z M60.5 19L61.5 12L56 17Z', behind: [catHead], thin: true },
      { d: catHead },
      { d: circle(45, 28, 2.2) + circle(55, 28, 2.2), solid: true },
      { d: 'M48.4 33h3.2l-1.6 2Z', solid: true },
      {
        d: 'M50 35Q48.5 38 46 37M50 35Q51.5 38 54 37M43 33.5L33 31.5M43 35.5L33 37.5M57 33.5L67 31.5M57 35.5L67 37.5',
        thin: true,
      },
      { d: 'M6 71H94', thin: true },
    ],
  },
  {
    id: 'flower',
    label: 'Flower',
    emoji: '🌻',
    ops: [
      { d: 'M48.8 32Q47 54 48.6 75H51.4Q49.6 54 51.2 32Z', behind: [flowerCenter, ...flowerPetals] },
      { d: 'M49 58Q38 46 28 52Q38 63 49 58Z M51 50Q62 38 72 44Q62 55 51 50Z' },
      { d: 'M49 58Q38 54 31 52.5 M51 50Q62 46 69 44.5', thin: true },
      ...flowerPetals.map((p, i) => ({
        d: p,
        behind: [flowerCenter, flowerPetals[(i + 1) % 6]],
      })),
      { d: flowerCenter },
      { d: circle(86, 12, 6) },
      { d: sunRays(86, 12, 8.5, 12), thin: true },
      { d: 'M2 75Q20 70 40 74Q60 70 98 74', thin: true },
    ],
  },
  {
    id: 'fish',
    label: 'Fishy',
    emoji: '🐠',
    ops: [
      { d: 'M28 38L9 24Q13 38 9 52Z', behind: [fishBody] },
      { d: 'M38 25Q44 10 58 25Z', behind: [fishBody] },
      { d: 'M42 51Q46 61 56 51Z', behind: [fishBody] },
      { d: fishBody },
      { d: 'M56 26Q51 38 56 50', thin: false },
      { d: 'M44 24Q39 38 44 52M34 27Q30 38 34 49', thin: true },
      { d: circle(62, 34, 3.2) },
      { d: circle(62.8, 34, 1.4), solid: true },
      { d: 'M71.5 41Q68.5 43.5 66 41.5', thin: true },
      { d: circle(82, 24, 3) + circle(87, 14, 2.2) + circle(82, 6, 1.5) },
      { d: 'M14 75Q10 66 15 60Q20 54 15 47M24 75Q28 68 24 62', thin: true },
      { d: 'M80 75Q76 68 81 62Q86 57 82 52', thin: true },
    ],
  },
  {
    id: 'house',
    label: 'House',
    emoji: '🏡',
    ops: [
      { d: rect(61, 14, 7, 16), behind: [houseRoof] },
      { d: houseWalls, behind: [houseRoof] },
      { d: houseRoof },
      { d: circle(50, 27, 4.2) },
      { d: rect(44, 48, 12, 20) },
      { d: circle(53.6, 58.5, 0.9), solid: true },
      { d: rect(31, 42, 9, 9) + rect(60, 42, 9, 9) },
      { d: 'M35.5 42V51M31 46.5H40M64.5 42V51M60 46.5H69', thin: true },
      { d: 'M2 68H98', thin: false },
      { d: 'M44 68Q41 72 37 75M56 68Q59 72 63 75', thin: true },
      { d: circle(14, 13, 6) },
      { d: sunRays(14, 13, 8.5, 12), thin: true },
      { d: 'M80 14a4 4 0 0 1 7-3a5 5 0 0 1 8 3a3.5 3.5 0 0 1 0 7h-15a3.5 3.5 0 0 1 0-7Z' },
    ],
  },
]

/** Draw a coloring page outline filling a w x h canvas (expects ~4:3). */
export function drawTemplate(
  ctx: CanvasRenderingContext2D,
  id: TemplateId,
  w: number,
  h: number,
  color: string,
) {
  const tpl = TEMPLATES.find((t) => t.id === id)
  if (!tpl) return
  const s = Math.min(w / 100, h / 75)
  ctx.save()
  ctx.translate((w - 100 * s) / 2, (h - 75 * s) / 2)
  ctx.scale(s, s)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  for (const op of tpl.ops) {
    ctx.save()
    if (op.behind) {
      for (const occ of op.behind) {
        const clip = new Path2D(`M-10 -10H110V85H-10Z`)
        clip.addPath(path2d(occ))
        ctx.clip(clip, 'evenodd')
      }
    }
    if (op.solid) {
      ctx.fill(path2d(op.d))
    } else {
      ctx.lineWidth = op.thin ? 0.5 : 0.75
      ctx.stroke(path2d(op.d))
    }
    ctx.restore()
  }
  ctx.restore()
}
