import confetti from 'canvas-confetti'

const COLORS = ['#ff6fae', '#ffb3d9', '#4fc3f7', '#2b7de9', '#ffe066', '#b388ff', '#7ee8c8']

/* =====================================================================================
 * Tiny WebAudio synth. No audio files: every sound is built from oscillators, a shared
 * noise buffer, filters and envelopes, then routed through one soft master bus:
 *
 *   voices ──► dry ─┐
 *          └─► reverb send ─► convolver ─┤─► master gain ─► lowpass ─► compressor ─► speakers
 * ===================================================================================== */

let soundOn = true
const MASTER_LEVEL = 0.8

type Ctor = typeof AudioContext
let ctx: AudioContext | null = null
let master: GainNode | null = null
let bus: GainNode | null = null // where voices go (dry)
let verb: GainNode | null = null // reverb send
let noiseBuf: AudioBuffer | null = null

export function setSoundOn(on: boolean) {
  soundOn = on
  if (ctx && master) {
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setTargetAtTime(on ? MASTER_LEVEL : 0, t, 0.03)
  }
}

function build(): AudioContext | null {
  if (ctx) return ctx
  try {
    const C: Ctor | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
    if (!C) return null
    const a = new C()
    const comp = a.createDynamicsCompressor()
    comp.threshold.value = -20
    comp.knee.value = 24
    comp.ratio.value = 4
    comp.attack.value = 0.004
    comp.release.value = 0.25
    // A gentle top-end roll-off keeps square/saw voices from ever sounding harsh.
    const soften = a.createBiquadFilter()
    soften.type = 'lowpass'
    soften.frequency.value = 9000
    soften.Q.value = 0.5
    master = a.createGain()
    master.gain.value = soundOn ? MASTER_LEVEL : 0
    master.connect(soften).connect(comp).connect(a.destination)

    bus = a.createGain()
    bus.connect(master)

    // Small, airy "room": a generated stereo impulse response of decaying noise.
    const len = Math.floor(a.sampleRate * 1.4)
    const ir = a.createBuffer(2, len, a.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
    }
    const conv = a.createConvolver()
    conv.buffer = ir
    const wet = a.createGain()
    wet.gain.value = 0.35
    verb = a.createGain()
    verb.connect(conv).connect(wet).connect(master)

    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate)
    const n = noiseBuf.getChannelData(0)
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1

    ctx = a
    return a
  } catch {
    return null
  }
}

function audio(): AudioContext | null {
  if (!soundOn) return null
  const a = build()
  if (!a) return null
  // iOS can leave the context 'suspended' or 'interrupted' (e.g. after the app was backgrounded).
  if (a.state !== 'running') void a.resume().catch(() => undefined)
  return a
}

/* ---------- iOS Safari / autoplay unlock: resume on the first real user gesture ---------- */

function unlock() {
  const a = build()
  if (!a) return
  const done = () => {
    if (a.state === 'running') {
      for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, unlock, true)
    }
  }
  try {
    // Playing a 1-sample silent buffer inside the gesture is what old iOS needs.
    const src = a.createBufferSource()
    src.buffer = a.createBuffer(1, 1, 22050)
    src.connect(a.destination)
    src.start(0)
  } catch {
    /* ignore */
  }
  if (a.state !== 'running') void a.resume().then(done, () => undefined)
  else done()
}
const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'keydown'] as const
if (typeof window !== 'undefined') {
  for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, unlock, { capture: true, passive: true })
}

/* ---------- building blocks ---------- */

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
/** Nudge a pitch by up to ±cents so repeated sounds don't feel robotic. */
const vary = (f: number, cents = 35) => f * Math.pow(2, rnd(-cents, cents) / 1200)

/** Attack/decay envelope that never clicks: starts from ~0, short linear attack, exponential tail. */
function envelope(p: AudioParam, t: number, peak: number, attack: number, dur: number) {
  p.cancelScheduledValues(t)
  p.setValueAtTime(0.0001, t)
  p.linearRampToValueAtTime(peak, t + attack)
  p.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01))
}

function out(a: AudioContext, node: AudioNode, wet = 0.15) {
  node.connect(bus ?? a.destination)
  if (verb && wet > 0) {
    const s = a.createGain()
    s.gain.value = wet
    node.connect(s).connect(verb)
  }
}

interface ToneOpts {
  freq: number
  at?: number
  dur?: number
  type?: OscillatorType
  gain?: number
  attack?: number
  /** Glide to this pitch… */
  to?: number
  /** …over this many seconds (default: the whole note). */
  glide?: number
  vibrato?: number // depth in Hz
  vibratoRate?: number
  lowpass?: number
  wet?: number
}

function tone(o: ToneOpts) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + (o.at ?? 0) + 0.005
  const dur = o.dur ?? 0.3
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? dur))
  if (o.vibrato) {
    const lfo = a.createOscillator()
    const depth = a.createGain()
    lfo.frequency.value = o.vibratoRate ?? 6
    depth.gain.setValueAtTime(o.vibrato, t)
    depth.gain.exponentialRampToValueAtTime(0.01, t + dur)
    lfo.connect(depth).connect(osc.frequency)
    lfo.start(t)
    lfo.stop(t + dur + 0.05)
  }
  envelope(g.gain, t, o.gain ?? 0.15, o.attack ?? 0.01, dur)
  let last: AudioNode = osc.connect(g)
  if (o.lowpass) {
    const f = a.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.lowpass
    last = last.connect(f)
  }
  out(a, last, o.wet ?? 0.15)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** Music-box / glockenspiel note: sine fundamental plus quick-fading bright partials. */
function bell(freq: number, at = 0, dur = 0.6, gain = 0.12, wet = 0.3) {
  tone({ freq, at, dur, gain, attack: 0.004, wet })
  tone({ freq: freq * 2.01, at, dur: dur * 0.45, gain: gain * 0.35, attack: 0.003, wet })
  tone({ freq: freq * 3.98, at, dur: dur * 0.2, gain: gain * 0.12, attack: 0.002, wet })
}

interface NoiseOpts {
  at?: number
  dur?: number
  gain?: number
  attack?: number
  filter?: BiquadFilterType
  from?: number
  to?: number
  q?: number
  wet?: number
}

function noise(o: NoiseOpts) {
  const a = audio()
  if (!a || !noiseBuf) return
  const t = a.currentTime + (o.at ?? 0) + 0.005
  const dur = o.dur ?? 0.3
  const src = a.createBufferSource()
  src.buffer = noiseBuf
  const f = a.createBiquadFilter()
  f.type = o.filter ?? 'bandpass'
  f.Q.value = o.q ?? 1
  f.frequency.setValueAtTime(o.from ?? 1200, t)
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur)
  const g = a.createGain()
  envelope(g.gain, t, o.gain ?? 0.1, o.attack ?? 0.01, dur)
  out(a, src.connect(f).connect(g), o.wet ?? 0.1)
  src.start(t, Math.random() * Math.max(0, 1.9 - dur))
  src.stop(t + dur + 0.05)
}

/** Drops a repeat of the same sound fired within `ms` (double taps, re-renders). */
const lastAt = new Map<string, number>()
function throttle(key: string, ms = 45): boolean {
  const now = performance.now()
  if (now - (lastAt.get(key) ?? -1e9) < ms) return false
  lastAt.set(key, now)
  return true
}

// Note names → Hz (equal temperament, A4 = 440).
const N = (semisFromA4: number) => 440 * Math.pow(2, semisFromA4 / 12)
const C5 = N(3), D5 = N(5), E5 = N(7), G5 = N(10), A5 = N(12), B5 = N(14)
const C6 = N(15), D6 = N(17), E6 = N(19), G6 = N(22), A6 = N(24), C7 = N(27)
const G4 = N(-2), A4 = N(0), B4 = N(2), C4 = N(-9), F4 = N(-4)
const HIGH_PENTA = [C7, N(29), N(31), N(34), N(36), N(39)] // C7 D7 E7 G7 A7 C8

/* ---------- the sounds ---------- */

export const sounds = {
  /** Soft bubble "bloop". */
  pop() {
    if (!throttle('pop')) return
    const f = vary(420, 80)
    tone({ freq: f, to: f * 2.4, glide: 0.07, dur: 0.12, type: 'sine', gain: 0.16, attack: 0.004, wet: 0.08 })
    tone({ freq: f * 2, to: f * 3.2, glide: 0.05, dur: 0.06, type: 'triangle', gain: 0.03, attack: 0.002, wet: 0 })
  },
  /** Music-box arpeggio. */
  chime() {
    if (!throttle('chime', 120)) return
    const up = Math.random() < 0.5 ? [G5, B5, D6, G6] : [E5, G5, C6, E6]
    up.forEach((f, i) => bell(vary(f, 8), i * 0.075, 0.7, 0.1))
  },
  /** Bright "you've got something!" bell. */
  ding() {
    if (!throttle('ding', 120)) return
    bell(C6, 0, 0.9, 0.14)
    bell(G6, 0.11, 1.1, 0.09)
  },
  /** Celebration melody with bass, chord pad and twinkles. */
  fanfare() {
    if (!throttle('fanfare', 400)) return
    const mel: Array<[number, number, number]> = [
      [C5, 0, 0.16], [E5, 0.14, 0.16], [G5, 0.28, 0.16], [C6, 0.42, 0.42],
      [A5, 0.82, 0.14], [C6, 0.96, 0.14], [E6, 1.1, 0.95],
    ]
    mel.forEach(([f, s, d]) => {
      tone({ freq: f, at: s, dur: d + 0.1, type: 'triangle', gain: 0.13, attack: 0.012, wet: 0.25 })
      tone({ freq: f, at: s, dur: d + 0.05, type: 'square', gain: 0.025, attack: 0.012, lowpass: 2400, wet: 0.2 })
      tone({ freq: f * 2, at: s, dur: d * 0.6, type: 'sine', gain: 0.03, attack: 0.01, wet: 0.3 })
    })
    // Oom-pah bass.
    ;[[C4, 0], [G4 / 2, 0.28], [C4, 0.42], [F4 / 2, 0.82], [C4, 1.1]].forEach(([f, s]) =>
      tone({ freq: f, at: s, dur: 0.3, type: 'sine', gain: 0.12, attack: 0.01, wet: 0.05 }),
    )
    // Warm chord swell under the last note.
    ;[C5, E5, G5].forEach((f) => {
      tone({ freq: f, at: 1.1, dur: 1.3, type: 'sawtooth', gain: 0.025, attack: 0.12, lowpass: 1600, vibrato: 3, vibratoRate: 5, wet: 0.4 })
    })
    sounds.sparkle(0.45)
    sounds.sparkle(1.15)
    noise({ at: 1.1, dur: 1.0, filter: 'highpass', from: 6000, gain: 0.03, attack: 0.05, wet: 0.4 })
  },

  /** Cute kitten meow: a pitch-bent buzzy tone shaped by moving "vowel" formants (m-ee-ow). */
  meow() {
    if (!throttle('meow', 200)) return
    const a = audio()
    if (!a) return
    const t = a.currentTime + 0.01
    const base = rnd(600, 760)
    const dur = rnd(0.5, 0.65)
    const osc = a.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(base * 0.8, t)
    osc.frequency.exponentialRampToValueAtTime(base * 1.25, t + dur * 0.3)
    osc.frequency.exponentialRampToValueAtTime(base * 0.95, t + dur * 0.7)
    osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur)
    const vib = a.createOscillator()
    const vibD = a.createGain()
    vib.frequency.value = 7
    vibD.gain.value = base * 0.012
    vib.connect(vibD).connect(osc.frequency)
    // "m": closed mouth opening up.
    const mouth = a.createBiquadFilter()
    mouth.type = 'lowpass'
    mouth.frequency.setValueAtTime(500, t)
    mouth.frequency.exponentialRampToValueAtTime(5000, t + 0.08)
    mouth.frequency.exponentialRampToValueAtTime(1800, t + dur)
    const f1 = a.createBiquadFilter()
    const f2 = a.createBiquadFilter()
    f1.type = f2.type = 'bandpass'
    f1.Q.value = 5
    f2.Q.value = 7
    // ee → ow
    f1.frequency.setValueAtTime(450, t)
    f1.frequency.linearRampToValueAtTime(700, t + dur * 0.4)
    f1.frequency.linearRampToValueAtTime(520, t + dur)
    f2.frequency.setValueAtTime(2300, t)
    f2.frequency.linearRampToValueAtTime(1900, t + dur * 0.4)
    f2.frequency.exponentialRampToValueAtTime(950, t + dur)
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.5, t + 0.06)
    g.gain.linearRampToValueAtTime(0.42, t + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const mix = a.createGain()
    mix.gain.value = 1
    osc.connect(mouth)
    mouth.connect(f1).connect(mix)
    mouth.connect(f2).connect(mix)
    // A touch of pure tone for body.
    const body = a.createGain()
    body.gain.value = 0.04
    mouth.connect(body).connect(mix)
    out(a, mix.connect(g), 0.12)
    osc.start(t)
    vib.start(t)
    osc.stop(t + dur + 0.05)
    vib.stop(t + dur + 0.05)
  },

  /** ~1s contented purr: low noise rumble pulsing ~24 times a second, breathing in and out. */
  purr() {
    if (!throttle('purr', 600)) return
    const a = audio()
    if (!a || !noiseBuf) return
    const t = a.currentTime + 0.01
    const dur = 1.1
    const src = a.createBufferSource()
    src.buffer = noiseBuf
    const lp = a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 380
    lp.Q.value = 2
    const am = a.createGain()
    am.gain.value = 0.5
    const lfo = a.createOscillator()
    const lfoD = a.createGain()
    lfo.frequency.value = rnd(22, 27)
    lfoD.gain.value = 0.5
    lfo.connect(lfoD).connect(am.gain)
    const hum = a.createOscillator()
    hum.type = 'triangle'
    hum.frequency.value = lfo.frequency.value * 2
    const humG = a.createGain()
    humG.gain.value = 0.18
    hum.connect(humG).connect(am)
    const g = a.createGain()
    // two breaths: in (quieter) and out
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.28, t + 0.12)
    g.gain.linearRampToValueAtTime(0.12, t + 0.48)
    g.gain.linearRampToValueAtTime(0.4, t + 0.62)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    out(a, src.connect(lp).connect(am).connect(g), 0.05)
    src.start(t, Math.random())
    lfo.start(t)
    hum.start(t)
    for (const n of [src, lfo, hum]) n.stop(t + dur + 0.05)
  },

  /** Springy cartoon boing. */
  boing() {
    if (!throttle('boing', 80)) return
    const f = vary(190, 60)
    tone({ freq: f, to: f * 2.6, glide: 0.28, dur: 0.45, type: 'triangle', gain: 0.16, attack: 0.006, vibrato: 45, vibratoRate: 16, wet: 0.12 })
    tone({ freq: f * 2, to: f * 5.2, glide: 0.28, dur: 0.25, type: 'sine', gain: 0.04, attack: 0.006, vibrato: 90, vibratoRate: 16, wet: 0.1 })
  },

  /** Airy swoosh. `down` sweeps high→low (closing things). */
  whoosh(down?: unknown) {
    if (!throttle('whoosh', 80)) return
    const [from, to] = down === true ? [2600, 380] : [350, 2800]
    noise({ dur: 0.34, filter: 'bandpass', from: vary(from, 100), to: vary(to, 100), q: 1.4, gain: 0.16, attack: 0.1, wet: 0.15 })
  },

  /** High glittery twinkle arpeggio. */
  sparkle(delay?: unknown) {
    // Tolerates being passed straight to onClick (the event is ignored).
    const at = typeof delay === 'number' ? delay : 0
    if (at === 0 && !throttle('sparkle', 90)) return
    const n = 5 + Math.floor(Math.random() * 3)
    let notes = [...HIGH_PENTA].sort(() => Math.random() - 0.5).slice(0, n)
    if (Math.random() < 0.6) notes = notes.sort((x, y) => x - y)
    notes.forEach((f, i) => {
      const s = at + i * rnd(0.035, 0.055)
      tone({ freq: f / 2, at: s, dur: 0.35, gain: 0.055, attack: 0.003, wet: 0.45 })
      tone({ freq: (f / 2) * 2.76, at: s, dur: 0.12, gain: 0.012, attack: 0.002, wet: 0.45 })
    })
    noise({ at, dur: 0.35, filter: 'highpass', from: 7000, gain: 0.025, attack: 0.02, wet: 0.3 })
  },

  /** Classic two-note coin. */
  coin() {
    if (!throttle('coin', 60)) return
    const k = vary(1, 15)
    tone({ freq: B5 * k, dur: 0.08, type: 'square', gain: 0.05, attack: 0.003, lowpass: 3800, wet: 0.05 })
    tone({ freq: B5 * k, dur: 0.08, type: 'sine', gain: 0.07, attack: 0.003, wet: 0.05 })
    tone({ freq: E6 * k, at: 0.075, dur: 0.42, type: 'square', gain: 0.045, attack: 0.003, lowpass: 3800, wet: 0.15 })
    tone({ freq: E6 * k, at: 0.075, dur: 0.45, type: 'sine', gain: 0.07, attack: 0.003, wet: 0.15 })
  },

  /** Tiny UI tick for tabs and toggles. */
  blip() {
    if (!throttle('blip', 40)) return
    const f = vary(1250, 60)
    tone({ freq: f, to: f * 1.35, glide: 0.04, dur: 0.07, type: 'sine', gain: 0.09, attack: 0.003, wet: 0.04 })
  },

  /** Ta-DAA! */
  tada() {
    if (!throttle('tada', 300)) return
    ;[G4, B4, D5].forEach((f) => tone({ freq: f, dur: 0.12, type: 'triangle', gain: 0.07, attack: 0.006, wet: 0.15 }))
    ;[C5, E5, G5, C6].forEach((f, i) => {
      tone({ freq: f, at: 0.14 + i * 0.012, dur: 0.95, type: 'triangle', gain: 0.08, attack: 0.012, vibrato: 4, vibratoRate: 5.5, wet: 0.3 })
      tone({ freq: f, at: 0.14 + i * 0.012, dur: 0.8, type: 'sawtooth', gain: 0.015, attack: 0.03, lowpass: 2200, wet: 0.3 })
    })
    tone({ freq: C4, at: 0.14, dur: 0.6, gain: 0.12, attack: 0.01, wet: 0.05 })
    sounds.sparkle(0.3)
  },

  /** Very short click, for a spinning wheel. Safe to call rapidly. */
  tick() {
    if (!throttle('tick', 25)) return
    noise({ dur: 0.025, filter: 'bandpass', from: vary(3200, 150), q: 3, gain: 0.12, attack: 0.001, wet: 0 })
    tone({ freq: vary(1900, 80), dur: 0.03, type: 'triangle', gain: 0.035, attack: 0.001, wet: 0 })
  },

  /** Magical rising shimmer (something new unlocked). */
  unlock() {
    if (!throttle('unlock', 300)) return
    tone({ freq: 330, to: 1320, glide: 0.6, dur: 0.75, type: 'sine', gain: 0.06, attack: 0.08, vibrato: 8, vibratoRate: 9, wet: 0.4 })
    tone({ freq: 333, to: 1335, glide: 0.6, dur: 0.75, type: 'triangle', gain: 0.03, attack: 0.08, wet: 0.4 })
    ;[C5, E5, G5, C6, E6, G6, C7].forEach((f, i) => bell(f, 0.08 + i * 0.07, 0.6, 0.06 + i * 0.005, 0.45))
    noise({ at: 0.1, dur: 0.8, filter: 'bandpass', from: 2000, to: 9000, q: 0.8, gain: 0.035, attack: 0.3, wet: 0.4 })
  },

  /** Camera-shutter click: two quick mechanical clacks. */
  shutter() {
    if (!throttle('shutter', 150)) return
    noise({ dur: 0.045, filter: 'bandpass', from: 2400, q: 1.5, gain: 0.22, attack: 0.001, wet: 0.05 })
    noise({ at: 0.07, dur: 0.06, filter: 'bandpass', from: 1500, q: 1.2, gain: 0.18, attack: 0.001, wet: 0.08 })
    tone({ freq: 160, at: 0.07, dur: 0.05, type: 'sine', gain: 0.08, attack: 0.002, wet: 0 })
  },
}

/* ---------- jingles + confetti ---------- */

const JINGLES: Array<() => void> = [
  // happy climb
  () => [C6, E6, G6, C7].forEach((f, i) => bell(vary(f, 6), i * 0.07, 0.6, 0.1)),
  // skip-skip-hooray
  () => {
    ;[[E5, 0], [G5, 0.1], [E5, 0.2], [C6, 0.3], [G6, 0.42]].forEach(([f, s]) =>
      tone({ freq: f, at: s, dur: 0.22, type: 'triangle', gain: 0.11, attack: 0.008, wet: 0.2 }),
    )
    sounds.sparkle(0.45)
  },
  // little ukulele strum + bell
  () => {
    ;[C5, E5, G5, A5].forEach((f, i) => tone({ freq: f, at: i * 0.025, dur: 0.5, type: 'triangle', gain: 0.07, attack: 0.004, lowpass: 2600, wet: 0.2 }))
    ;[[D6, 0.22], [E6, 0.34], [A6, 0.46]].forEach(([f, s]) => bell(f, s, 0.6, 0.09))
  },
  // bouncy bubbles
  () => {
    ;[A4, C5, E5, A5].forEach((f, i) =>
      tone({ freq: f, to: f * 1.5, glide: 0.06, at: i * 0.09, dur: 0.14, type: 'sine', gain: 0.13, attack: 0.004, wet: 0.15 }),
    )
    bell(E6, 0.38, 0.8, 0.1)
    bell(A6, 0.46, 0.9, 0.06)
  },
]
let lastJingle = -1

function emojiShapes() {
  try {
    return ['⭐', '🌺', '🎀', '💖'].map((text) => confetti.shapeFromText({ text, scalar: 2 }))
  } catch {
    return undefined
  }
}

/** Small burst for finishing a chore or bonus quest. */
export function smallWin(origin?: { x: number; y: number }) {
  if (throttle('smallWin', 150)) {
    let i = Math.floor(Math.random() * JINGLES.length)
    if (i === lastJingle) i = (i + 1) % JINGLES.length
    lastJingle = i
    JINGLES[i]()
  }
  const o = origin ?? { x: 0.5, y: 0.6 }
  void confetti({ particleCount: 70, spread: 75, startVelocity: 38, origin: o, colors: COLORS, scalar: 1 })
  const shapes = emojiShapes()
  if (shapes) void confetti({ particleCount: 14, spread: 90, startVelocity: 30, origin: o, shapes, scalar: 2 })
}

/** Huge celebration for buying a prize. Runs for a few seconds. */
export function bigWin(durationMs = 4500) {
  sounds.fanfare()
  // Twinkles keep falling with the confetti.
  ;[1.9, 2.7, 3.5].forEach((s) => setTimeout(() => sounds.sparkle(), s * 1000))
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
