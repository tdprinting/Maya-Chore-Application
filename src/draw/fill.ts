/**
 * Scanline flood fill on an ImageData (in place).
 * `wall` marks pixels that always stop the fill (e.g. coloring-page outline pixels).
 * Returns true when anything was painted.
 */
export function floodFill(
  img: ImageData,
  wall: Uint8Array | null,
  sx: number,
  sy: number,
  rgb: [number, number, number],
  alpha: number,
  tolerance = 64,
): boolean {
  const { width: w, height: h, data } = img
  sx = Math.floor(sx)
  sy = Math.floor(sy)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false
  const seed = sy * w + sx
  if (wall && wall[seed]) return false

  const s = seed * 4
  const sr = data[s], sg = data[s + 1], sb = data[s + 2], sa = data[s + 3]
  const seedClear = sa < 12

  const matches = (i: number): boolean => {
    if (wall && wall[i]) return false
    const o = i * 4
    const a = data[o + 3]
    if (seedClear) return a < 12 + tolerance / 4
    if (a < 12) return false
    return (
      Math.abs(data[o] - sr) + Math.abs(data[o + 1] - sg) + Math.abs(data[o + 2] - sb) + Math.abs(a - sa) <=
      tolerance
    )
  }

  const mask = new Uint8Array(w * h)
  const stack: number[] = [sx, sy]
  while (stack.length) {
    const y = stack.pop()!
    let x = stack.pop()!
    let i = y * w + x
    while (x >= 0 && !mask[i] && matches(i)) {
      x--
      i--
    }
    x++
    i++
    let up = false
    let down = false
    while (x < w && !mask[i] && matches(i)) {
      mask[i] = 1
      if (y > 0) {
        const u = i - w
        if (!mask[u] && matches(u)) {
          if (!up) {
            stack.push(x, y - 1)
            up = true
          }
        } else up = false
      }
      if (y < h - 1) {
        const dn = i + w
        if (!mask[dn] && matches(dn)) {
          if (!down) {
            stack.push(x, y + 1)
            down = true
          }
        } else down = false
      }
      x++
      i++
    }
  }

  // Grow the region by 1px so antialiased edges don't leave a halo.
  const grown = new Uint8Array(mask)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const i = row + x
      if (!mask[i]) continue
      if (x > 0) grown[i - 1] = 1
      if (x < w - 1) grown[i + 1] = 1
      if (y > 0) grown[i - w] = 1
      if (y < h - 1) grown[i + w] = 1
    }
  }

  const [r, g, b] = rgb
  const fa = Math.max(0, Math.min(1, alpha))
  let painted = false
  for (let i = 0; i < grown.length; i++) {
    if (!grown[i]) continue
    painted = true
    const o = i * 4
    if (fa >= 0.999) {
      data[o] = r
      data[o + 1] = g
      data[o + 2] = b
      data[o + 3] = 255
      continue
    }
    // source-over blend (non-premultiplied)
    const da = data[o + 3] / 255
    const oa = fa + da * (1 - fa)
    if (oa <= 0) continue
    data[o] = Math.round((r * fa + data[o] * da * (1 - fa)) / oa)
    data[o + 1] = Math.round((g * fa + data[o + 1] * da * (1 - fa)) / oa)
    data[o + 2] = Math.round((b * fa + data[o + 2] * da * (1 - fa)) / oa)
    data[o + 3] = Math.round(oa * 255)
  }
  return painted
}
