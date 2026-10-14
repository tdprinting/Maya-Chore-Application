import confetti from 'canvas-confetti'

const COLORS = ['#ff6fae', '#ffb3d9', '#4fc3f7', '#2b7de9', '#ffe066', '#b388ff', '#7ee8c8']

let soundOn = true
export function setSoundOn(on: boolean) {
  soundOn = on
}

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  if (!soundOn) return null
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18) {
  const a = audio()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.value = freq
  const t = a.currentTime + start
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.05)
}

export const sounds = {
  pop() {
    tone(660, 0, 0.12, 'triangle', 0.12)
  },
  chime() {
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.35, 'sine'))
  },
  ding() {
    tone(1046, 0, 0.5, 'sine', 0.2)
    tone(1568, 0.12, 0.6, 'sine', 0.12)
  },
  fanfare() {
    const notes: Array<[number, number, number]> = [
      [523, 0, 0.18], [659, 0.15, 0.18], [784, 0.3, 0.18], [1046, 0.45, 0.5],
      [784, 0.8, 0.15], [1046, 0.95, 0.9],
    ]
    notes.forEach(([f, s, d]) => {
      tone(f, s, d, 'triangle', 0.16)
      tone(f / 2, s, d, 'sine', 0.08)
    })
  },
}

function emojiShapes() {
  try {
    return ['⭐', '🌺', '🎀', '💖'].map((text) => confetti.shapeFromText({ text, scalar: 2 }))
  } catch {
    return undefined
  }
}

/** Small burst for finishing a chore or bonus quest. */
export function smallWin(origin?: { x: number; y: number }) {
  sounds.chime()
  const o = origin ?? { x: 0.5, y: 0.6 }
  void confetti({ particleCount: 70, spread: 75, startVelocity: 38, origin: o, colors: COLORS, scalar: 1 })
  const shapes = emojiShapes()
  if (shapes) void confetti({ particleCount: 14, spread: 90, startVelocity: 30, origin: o, shapes, scalar: 2 })
}

/** Huge celebration for buying a prize. Runs for a few seconds. */
export function bigWin(durationMs = 4500) {
  sounds.fanfare()
  const end = Date.now() + durationMs
  const shapes = emojiShapes()
  const frame = () => {
    void confetti({ particleCount: 6, angle: 60, spread: 65, origin: { x: 0, y: 0.75 }, colors: COLORS })
    void confetti({ particleCount: 6, angle: 120, spread: 65, origin: { x: 1, y: 0.75 }, colors: COLORS })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
  const bursts = [300, 1100, 1900, 2700, 3500]
  bursts.forEach((t, i) =>
    setTimeout(() => {
      void confetti({
        particleCount: 140,
        spread: 360,
        startVelocity: 45,
        ticks: 120,
        origin: { x: 0.2 + 0.15 * i, y: 0.3 + (i % 2) * 0.15 },
        colors: COLORS,
      })
      if (shapes) void confetti({ particleCount: 20, spread: 360, startVelocity: 30, origin: { x: 0.5, y: 0.4 }, shapes, scalar: 2.5 })
    }, t),
  )
}

/** Turn a click/tap target into a confetti origin. */
export function originOf(el: Element | null): { x: number; y: number } | undefined {
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
}
