import confetti from 'canvas-confetti'
import { AnimatePresence, animate, motion, useMotionValue, type MotionValue } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sounds } from '../fx'
import { dayKey, pickSpin, spinForDay } from '../logic'
import { useStore } from '../store'
import './fun.css'

/** Numbers around the wheel, clockwise from the top. Mixed up so big and small prizes alternate. */
const WHEEL = [1, 7, 3, 10, 2, 6, 4, 9, 5, 8]
const SLICE = 360 / WHEEL.length
const WEDGE_COLORS = ['#ff6fae', '#6ec6f0', '#ffd84d', '#7ee0c3', '#a98bff']
const CONFETTI = ['#ff6fae', '#ffd6e8', '#6ec6f0', '#ffd84d', '#7ee0c3', '#a98bff']

function wedgePath(i: number, r: number): string {
  const a0 = ((i * SLICE - SLICE / 2 - 90) * Math.PI) / 180
  const a1 = ((i * SLICE + SLICE / 2 - 90) * Math.PI) / 180
  return `M0 0 L${(r * Math.cos(a0)).toFixed(2)} ${(r * Math.sin(a0)).toFixed(2)} A${r} ${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(2)} ${(r * Math.sin(a1)).toFixed(2)} Z`
}

function cheerFor(stars: number): { big: string; small: string } {
  if (stars >= 10) return { big: 'JACKPOT!!', small: 'The biggest prize on the wheel! Lilo is doing backflips!' }
  if (stars >= 7) return { big: 'WOWZA!', small: 'A super lucky spin! ✨' }
  if (stars >= 4) return { big: 'Nice spin!', small: 'Stars in your pocket! 🌺' }
  return { big: 'Yay, stars!', small: 'Every star counts! Come back tomorrow for another spin.' }
}

function hoursLeft(): string {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const mins = Math.max(1, Math.round((midnight.getTime() - now.getTime()) / 60000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h} hr ${mins % 60} min` : `${mins} min`
}

/** The flat kawaii prize wheel. `rotate` is a motion value in degrees. */
function Wheel({ rotate, lit }: { rotate: MotionValue<number>; lit: boolean }) {
  return (
    <motion.div className="spin-wheel" style={{ rotate }}>
      <svg viewBox="-110 -110 220 220" width="100%" height="100%" aria-hidden>
        <circle r="108" fill="#2f4a8a" />
        <circle r="100" fill="#ffffff" />
        {WHEEL.map((n, i) => (
          <g key={i}>
            <path d={wedgePath(i, 94)} fill={WEDGE_COLORS[i % WEDGE_COLORS.length]} stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
            <g transform={`rotate(${i * SLICE}) translate(0 -66)`}>
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={n === 10 ? 22 : 26}
                fontWeight={800}
                fill={i % WEDGE_COLORS.length === 2 || i % WEDGE_COLORS.length === 3 ? '#2f4a8a' : '#ffffff'}
                fontFamily="inherit"
              >
                {n}
              </text>
              <text y="22" textAnchor="middle" dominantBaseline="central" fontSize="12">
                ⭐
              </text>
            </g>
          </g>
        ))}
        {Array.from({ length: 20 }, (_, i) => {
          const a = ((i * 18 - 90) * Math.PI) / 180
          return (
            <circle
              key={i}
              className={lit ? (i % 2 ? 'bulb odd' : 'bulb') : 'bulb off'}
              cx={(104 * Math.cos(a)).toFixed(2)}
              cy={(104 * Math.sin(a)).toFixed(2)}
              r="3.6"
            />
          )
        })}
        <circle r="24" fill="#ffffff" stroke="#2f4a8a" strokeWidth="4" />
        {/* a little bow on the hub */}
        <g transform="translate(0 1)">
          <path d="M-3 0 L-16 -9 Q-19 0 -16 9 Z" fill="#ff6fae" stroke="#e0508f" strokeWidth="2" strokeLinejoin="round" />
          <path d="M3 0 L16 -9 Q19 0 16 9 Z" fill="#ff6fae" stroke="#e0508f" strokeWidth="2" strokeLinejoin="round" />
          <circle r="5" fill="#ff6fae" stroke="#e0508f" strokeWidth="2" />
        </g>
      </svg>
    </motion.div>
  )
}

type Phase = 'ready' | 'spinning' | 'reveal'

/**
 * Full-screen Lucky Spin. Stars are paid before the wheel turns, so closing early never loses them.
 * `preview` (dev mode) spins without paying anything.
 */
export function LuckySpinOverlay({ open, onClose, preview, onWin }: { open: boolean; onClose: () => void; preview?: boolean; onWin?: (stars: number) => void }) {
  const { actions } = useStore()
  const rotate = useMotionValue(0)
  const pointer = useMotionValue(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [stars, setStars] = useState(0)
  const [err, setErr] = useState('')
  const lastTick = useRef({ idx: 0 })

  useEffect(() => {
    if (!open) return
    setPhase('ready')
    setErr('')
    rotate.set(0)
    lastTick.current.idx = 0
  }, [open, rotate])

  // A tick and a little pointer flick every time a peg passes.
  useEffect(
    () =>
      rotate.on('change', (deg) => {
        const idx = Math.floor((deg + SLICE / 2) / SLICE)
        if (idx !== lastTick.current.idx) {
          lastTick.current.idx = idx
          sounds.tick()
          animate(pointer, [-26, 0], { duration: 0.16, ease: 'easeOut' })
        }
      }),
    [rotate, pointer],
  )

  const spin = async () => {
    if (phase !== 'ready') return
    setErr('')
    setPhase('spinning')
    sounds.whoosh()
    let won: number
    try {
      won = preview ? pickSpin(Math.random()) : (await actions.spinWheel()).stars
    } catch (e) {
      setErr((e as Error).message || 'The wheel got stuck. Try again!')
      setPhase('ready')
      return
    }
    const slot = WHEEL.indexOf(won)
    const jitter = (Math.random() - 0.5) * SLICE * 0.6
    const target = 360 * 6 + ((360 - slot * SLICE - jitter) % 360)
    // A tiny wind-up backwards, then the big spin that slows right down at the end.
    await animate(rotate, -14, { duration: 0.25, ease: 'easeOut' })
    await animate(rotate, target, { duration: 4.6, ease: [0.12, 0.72, 0.18, 1] })
    setStars(won)
    setPhase('reveal')
    if (won >= 7) sounds.fanfare()
    else sounds.tada()
    setTimeout(() => sounds.coin(), 450)
    const burst = (x: number, delay: number) =>
      setTimeout(() => void confetti({ particleCount: won >= 7 ? 120 : 70, spread: 100, startVelocity: 42, origin: { x, y: 0.45 }, colors: CONFETTI, zIndex: 120 }), delay)
    burst(0.5, 0)
    if (won >= 7) {
      burst(0.2, 350)
      burst(0.8, 650)
    }
    onWin?.(won)
  }

  const cheer = cheerFor(stars)

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fun-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => phase !== 'spinning' && onClose()}>
          <motion.div
            className="spin-stage"
            initial={{ scale: 0.6, y: 80, rotate: -6 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.7, y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            {phase !== 'spinning' && (
              <button type="button" className="fun-close" onClick={onClose} aria-label="Close">
                ✕
              </button>
            )}
            <h2 className="spin-title" aria-label="Lucky Spin">
              {'Lucky Spin!'.split('').map((ch, i) => (
                <motion.span
                  key={i}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.07, ease: 'easeInOut' }}
                >
                  {ch === ' ' ? ' ' : ch}
                </motion.span>
              ))}
            </h2>
            <p className="spin-sub">{preview ? 'Test spin: no stars are given.' : 'Spin once a day for 1 to 10 bonus stars!'}</p>
            <div className="spin-wheel-wrap">
              <motion.div className="spin-pointer" style={{ rotate: pointer }} aria-hidden>
                <svg viewBox="0 0 40 48" width="44" height="52">
                  <path d="M20 46 L5 14 A16 16 0 1 1 35 14 Z" fill="#ff6fae" stroke="#2f4a8a" strokeWidth="4" strokeLinejoin="round" />
                  <circle cx="20" cy="15" r="5" fill="#ffffff" />
                </svg>
              </motion.div>
              <Wheel rotate={rotate} lit={phase !== 'ready'} />
              <AnimatePresence>
                {phase === 'reveal' && (
                  <motion.div className="spin-reveal" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }}>
                    <div className="spin-rays" />
                    <motion.div className="spin-reveal-num" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                      +{stars}
                      <span>⭐</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait">
              {phase === 'reveal' ? (
                <motion.div key="won" className="spin-result" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35, type: 'spring' }}>
                  <strong>{cheer.big}</strong>
                  <p>
                    You won {stars} bonus {stars === 1 ? 'star' : 'stars'}! {cheer.small}
                  </p>
                  <button type="button" className="btn big go" onClick={onClose}>
                    Yay! ⭐
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="spin"
                  type="button"
                  className="btn big go spin-btn"
                  disabled={phase === 'spinning'}
                  animate={phase === 'ready' ? { scale: [1, 1.07, 1] } : { scale: 0.95 }}
                  transition={phase === 'ready' ? { duration: 1.1, repeat: Infinity } : undefined}
                  whileTap={{ scale: 0.85, rotate: -4 }}
                  onClick={spin}
                >
                  {phase === 'spinning' ? 'Spinning… 🌀' : 'SPIN! 🎡'}
                </motion.button>
              )}
            </AnimatePresence>
            {err && <p className="error">{err}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Home screen card: a wiggly invitation to spin, or "come back tomorrow" once she has. */
export function SpinCard({ onWin }: { onWin?: (stars: number) => void }) {
  const { data } = useStore()
  const [open, setOpen] = useState(false)
  const today = dayKey()
  const done = spinForDay(data.ledger, today)
  // While the overlay is open the card keeps its "ready" look, so the reveal isn't spoiled behind it.
  const showDone = done && !open
  return (
    <>
      <motion.button
        type="button"
        className={showDone ? 'card fun-card spin-card done' : 'card fun-card spin-card'}
        whileTap={{ scale: 0.94, rotate: -2 }}
        animate={showDone ? undefined : { rotate: [0, -2, 2, -1, 0] }}
        transition={showDone ? undefined : { duration: 0.7, repeat: Infinity, repeatDelay: 2.6 }}
        onClick={() => {
          sounds.boing()
          setOpen(true)
        }}
        disabled={!!showDone}
      >
        <motion.span
          className="spin-card-wheel"
          animate={showDone ? { rotate: 0 } : { rotate: 360 }}
          transition={showDone ? undefined : { duration: 6, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        >
          <MiniWheel />
        </motion.span>
        {showDone ? (
          <span className="fun-card-text">
            <strong>
              You won +{done.amount} ⭐ today!
            </strong>
            <small>Come back tomorrow for another spin 🌙 (in {hoursLeft()})</small>
          </span>
        ) : (
          <span className="fun-card-text">
            <strong>Lucky Spin! 🎡</strong>
            <small>Tap to spin for 1 to 10 bonus stars</small>
          </span>
        )}
        {!showDone && <span className="fun-badge">FREE!</span>}
      </motion.button>
      <LuckySpinOverlay open={open} onClose={() => setOpen(false)} onWin={onWin} />
    </>
  )
}

function MiniWheel() {
  return (
    <svg viewBox="-50 -50 100 100" width="64" height="64">
      <circle r="48" fill="#2f4a8a" />
      {WHEEL.map((_, i) => (
        <path key={i} d={wedgePath(i, 42)} fill={WEDGE_COLORS[i % WEDGE_COLORS.length]} stroke="#fff" strokeWidth="2" />
      ))}
      <circle r="10" fill="#fff" stroke="#2f4a8a" strokeWidth="3" />
      <circle r="4" fill="#ff6fae" />
    </svg>
  )
}
