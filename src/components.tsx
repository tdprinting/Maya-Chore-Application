import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { sounds } from './fx'
import { useStore } from './store'
import { compressImage } from './util'

export { Mascot } from './art/Mascot'
import { Mascot } from './art/Mascot'
import { Icon, type IconName } from './art/Icons'

export function Stars({ n, big }: { n: number; big?: boolean }) {
  return (
    <span className={big ? 'stars stars-big' : 'stars'}>
      <span className="star-icon">
        <Icon name="star" size={big ? 34 : 24} active />
      </span>
      <AnimatedNumber value={n} />
    </span>
  )
}

export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  // Where the number currently is, so a change mid-animation continues from there instead of jumping back.
  const current = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const a = current.current
    if (a === value) return
    const dur = 900
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      current.current = Math.round(a + (value - a) * eased)
      setShown(current.current)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{shown}</>
}

/** Shows a stored photo (data URL in demo mode, private Supabase file otherwise). */
export function Photo({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const { backend } = useStore()
  const [url, setUrl] = useState<string>()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let alive = true
    setUrl(undefined)
    if (src) backend.photoUrl(src).then((u) => alive && setUrl(u)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [src, backend])
  if (!src) return null
  return (
    <>
      <button type="button" className={`photo-btn ${className ?? ''}`} onClick={() => setOpen(true)}>
        {url ? <img src={url} alt={alt} /> : <span className="photo-loading">📷</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} wide>
        {url && <img src={url} alt={alt} className="photo-full" />}
      </Modal>
    </>
  )
}

/** Big friendly "take a picture" button. Uses the camera on iPad/iPhone. */
export function PhotoPicker({ value, onChange, label = 'Take a picture' }: { value?: Blob; onChange: (b?: Blob) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!value) return setPreview(undefined)
    const u = URL.createObjectURL(value)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [value])
  return (
    <div className="photo-picker">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setBusy(true)
          try {
            onChange(await compressImage(f))
            sounds.shutter()
            setTimeout(() => sounds.sparkle(), 160)
          } finally {
            setBusy(false)
          }
        }}
      />
      {preview ? (
        <div className="photo-preview">
          <motion.img
            key={preview}
            src={preview}
            alt="Your picture"
            initial={{ scale: 0.6, rotate: -6, opacity: 0, filter: 'brightness(2.2)' }}
            animate={{ scale: 1, rotate: 0, opacity: 1, filter: 'brightness(1)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 13 }}
          />
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => input.current?.click()}>
              🔄 Retake
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                sounds.whoosh(true)
                onChange(undefined)
              }}
            >
              ✖ Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn camera" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? '⏳ Getting picture…' : `📸 ${label}`}
        </button>
      )}
    </div>
  )
}

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const reduce = useReducedMotion()
  // Swoosh in / out when the modal actually changes state (not on first render).
  const was = useRef(open)
  useEffect(() => {
    if (was.current === open) return
    was.current = open
    if (open) {
      sounds.whoosh()
      setTimeout(() => sounds.pop(), 90)
    } else sounds.whoosh(true)
  }, [open])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className={wide ? 'modal wide' : 'modal'}
            initial={reduce ? { opacity: 0 } : { scale: 0.55, y: 90, rotate: -5, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, rotate: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.75, y: 50, rotate: 3, opacity: 0, transition: { duration: 0.18 } }}
            transition={
              reduce
                ? { duration: 0.15 }
                : {
                    default: { type: 'spring', stiffness: 360, damping: 15 },
                    // Lower damping on rotation = a playful little wobble as it lands.
                    rotate: { type: 'spring', stiffness: 260, damping: 6 },
                    opacity: { duration: 0.15 },
                  }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <motion.button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close"
              whileHover={reduce ? undefined : { rotate: 90, scale: 1.1 }}
              whileTap={{ scale: 0.8 }}
            >
              ✕
            </motion.button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** The giant "you bought it!" party screen. */
const ORBITERS = ['⭐', '💖', '🌟', '💗', '✨', '🎀', '⭐', '💕']

/** Stars and hearts circling the prize like little moons. */
function Orbit({ radius }: { radius: number }) {
  return (
    <motion.div
      aria-hidden
      style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }}
      initial={{ rotate: 0, scale: 0 }}
      animate={{ rotate: 360, scale: 1 }}
      transition={{ rotate: { duration: 9, repeat: Infinity, ease: 'linear' }, scale: { delay: 0.8, type: 'spring', stiffness: 160, damping: 10 } }}
    >
      {ORBITERS.map((o, i) => {
        const ang = (i / ORBITERS.length) * Math.PI * 2
        return (
          <motion.span
            key={i}
            style={{
              position: 'absolute',
              left: Math.cos(ang) * radius,
              top: Math.sin(ang) * radius,
              translate: '-50% -50%',
              fontSize: i % 2 ? '1.6rem' : '2.2rem',
              lineHeight: 1,
              display: 'inline-block',
            }}
            // Counter-spin + twinkle so each one stays upright and sparkly.
            animate={{ rotate: -360, scale: [1, 1.35, 1] }}
            transition={{
              rotate: { duration: 9, repeat: Infinity, ease: 'linear' },
              scale: { duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' },
            }}
          >
            {o}
          </motion.span>
        )
      })}
    </motion.div>
  )
}

export function BigCelebration({ show, emoji, title, subtitle, onDone }: { show: boolean; emoji: string; title: string; subtitle: string; onDone: () => void }) {
  const reduce = useReducedMotion()
  // bigWin() brings the fanfare; this adds twinkly bursts as each part of the screen appears.
  useEffect(() => {
    if (!show) return
    const ts = [600, 1600, 2200].map((ms) => setTimeout(() => sounds.sparkle(), ms))
    return () => ts.forEach(clearTimeout)
  }, [show])
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div className="celebration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onDone}>
          <div className="rays" />
          <motion.div
            className="celebration-emoji"
            style={{ position: 'relative' }}
            initial={{ scale: 0, rotate: -180 }}
            animate={reduce ? { scale: 1.2, rotate: 0 } : { scale: [0, 1.6, 1.2], rotate: [-180, 20, 0] }}
            transition={{ duration: reduce ? 0.2 : 1.1, ease: 'easeOut' }}
          >
            {!reduce && <Orbit radius={120} />}
            <motion.span
              animate={reduce ? undefined : { y: [0, -24, 0], scaleX: [1, 0.92, 1.08, 1], scaleY: [1, 1.08, 0.9, 1] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: 1.1 }}
              style={{ display: 'inline-block' }}
            >
              {emoji}
            </motion.span>
          </motion.div>
          <motion.h1
            className="celebration-title"
            initial={{ y: 80, opacity: 0, scale: 0.6 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 11 }}
          >
            {title}
          </motion.h1>
          <motion.p className="celebration-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
            {subtitle}
          </motion.p>
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6 }}>
            <Mascot size={150} mood="wow" />
          </motion.div>
          <motion.button
            className="btn big"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [0.4, 1.15, 1] }}
            transition={{ delay: 2.2, duration: 0.5 }}
            whileTap={{ scale: 0.9 }}
            onClick={onDone}
          >
            Yay! 🎉
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** A floating "+15 ⭐" that rises and fades. */
export function FloatingPoints({ text, onDone }: { text: string; onDone: () => void }) {
  const reduce = useReducedMotion()
  useEffect(() => {
    const t = setTimeout(() => sounds.coin(), 120)
    return () => clearTimeout(t)
  }, [])
  return (
    <motion.div
      className="floating-points"
      initial={{ y: 0, opacity: 0, scale: 0.5, rotate: 0 }}
      animate={
        reduce
          ? { opacity: [0, 1, 1, 0] }
          : { y: -160, opacity: [0, 1, 1, 0], scale: [0.5, 1.4, 1.2, 1], rotate: [0, -8, 6, -3, 0] }
      }
      transition={{ duration: 1.8, ease: 'easeOut' }}
      onAnimationComplete={onDone}
    >
      {text}
    </motion.div>
  )
}

export interface Toast {
  id: string
  emoji: string
  title: string
  body?: string
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  // Time only the oldest toast, so new arrivals don't keep pushing its dismissal back.
  const first = toasts[0]?.id
  useEffect(() => {
    if (!first) return
    const t = setTimeout(() => onDismiss(first), 5000)
    return () => clearTimeout(t)
  }, [first, onDismiss])
  const reduce = useReducedMotion()
  // A sprinkle of sound for each toast that pops in (alternating, so a burst of them isn't samey).
  const seen = useRef(new Set<string>())
  const flip = useRef(false)
  const ids = toasts.slice(0, 3).map((t) => t.id).join(',')
  useEffect(() => {
    let fresh = false
    for (const id of ids.split(',')) {
      if (id && !seen.current.has(id)) {
        seen.current.add(id)
        fresh = true
      }
    }
    if (!fresh) return
    flip.current = !flip.current
    // Small delay so it sparkles on top of whatever sound the caller just played.
    const t = setTimeout(() => (flip.current ? sounds.sparkle() : sounds.ding()), 140)
    return () => clearTimeout(t)
  }, [ids])
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.slice(0, 3).map((t) => (
          <motion.button
            key={t.id}
            layout
            className="toast"
            initial={reduce ? { opacity: 0 } : { y: -90, opacity: 0, scale: 0.6, rotate: -6 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { x: 320, opacity: 0, rotate: 12, transition: { duration: 0.25 } }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { default: { type: 'spring', stiffness: 420, damping: 13 }, rotate: { type: 'spring', stiffness: 300, damping: 5 }, opacity: { duration: 0.12 } }
            }
            whileTap={{ scale: 0.95 }}
            onClick={() => onDismiss(t.id)}
          >
            <motion.span
              className="toast-emoji"
              // framer does the wiggle here; switch off the stylesheet's CSS one so they don't fight over transform.
              style={reduce ? undefined : { animation: 'none' }}
              initial={reduce ? false : { scale: 0, rotate: -40 }}
              animate={reduce ? undefined : { scale: [0, 1.5, 1], rotate: [-40, 18, -12, 8, 0] }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              {t.emoji}
            </motion.span>
            <span>
              <strong>{t.title}</strong>
              {t.body && <small>{t.body}</small>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}

export interface Tab<T extends string> {
  id: T
  label: string
  icon: IconName
  badge?: number
}

export function TabBar<T extends string>({ tabs, current, onChange }: { tabs: Tab<T>[]; current: T; onChange: (t: T) => void }) {
  const reduce = useReducedMotion()
  return (
    <nav className="tabbar">
      {tabs.map((t) => {
        const on = t.id === current
        return (
          <motion.button
            key={t.id}
            type="button"
            className={on ? 'tab active' : 'tab'}
            whileTap={reduce ? undefined : { scale: 0.88 }}
            onClick={() => {
              if (!on) sounds.blip()
              onChange(t.id)
            }}
          >
            <motion.span
              className="tab-icon"
              // A happy double hop with a squish when chosen; idle tabs rest.
              animate={
                reduce
                  ? { scale: on ? 1.1 : 1 }
                  : on
                    ? { y: [0, -14, 0, -5, 0], scale: [1, 1.25, 0.95, 1.12, 1.1], rotate: [0, -10, 8, -4, 0] }
                    : { y: 0, scale: 1, rotate: 0 }
              }
              transition={{ duration: on && !reduce ? 0.65 : 0.2, ease: 'easeOut' }}
              whileHover={reduce || on ? undefined : { y: -4, rotate: [0, -8, 8, 0], transition: { duration: 0.4 } }}
            >
              <Icon name={t.icon} size={34} active={on} />
            </motion.span>
            <span className="tab-label">{t.label}</span>
            <AnimatePresence>
              {!!t.badge && (
                <motion.span
                  key="badge"
                  className="badge"
                  initial={{ scale: 0 }}
                  animate={reduce ? { scale: 1 } : { scale: [0, 1.4, 1], rotate: [0, -15, 10, 0] }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  {t.badge}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )
      })}
    </nav>
  )
}

export function Empty({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <p>{children}</p>
    </div>
  )
}

const PROGRESS_SPARKS = [
  { left: '8%', top: -10, e: '✨', d: 0 },
  { left: '30%', top: 10, e: '⭐', d: 0.35 },
  { left: '55%', top: -12, e: '✨', d: 0.7 },
  { left: '78%', top: 8, e: '💖', d: 0.2 },
  { left: '96%', top: -8, e: '⭐', d: 0.55 },
]

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const reduce = useReducedMotion()
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const full = pct >= 100
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <motion.div
        className="progress"
        aria-label={label}
        animate={full && !reduce ? { boxShadow: ['0 0 0px rgba(255,224,102,0)', '0 0 14px rgba(255,224,102,0.95)', '0 0 0px rgba(255,224,102,0)'] } : { boxShadow: '0 0 0px rgba(255,224,102,0)' }}
        transition={full ? { duration: 1.6, repeat: Infinity, delay: 1 } : { duration: 0.3 }}
      >
        <motion.div
          className="progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0.3 } : { type: 'spring', stiffness: 60, damping: 12, mass: 0.9 }}
        />
      </motion.div>
      {full && !reduce && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {PROGRESS_SPARKS.map((s, i) => (
            <motion.span
              key={i}
              style={{ position: 'absolute', left: s.left, top: s.top, fontSize: 14, lineHeight: 1, translate: '-50% 0', display: 'inline-block' }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 0], opacity: [0, 1, 0], rotate: [0, 90, 180], y: [4, -6, -10] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6, delay: 1 + s.d, ease: 'easeOut' }}
            >
              {s.e}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A button that asks "are you sure?" in place: the first tap arms it, a second tap within a few
 * seconds runs the action. Works everywhere, including hosts where window.confirm() is blocked.
 */
export function ConfirmButton({
  className = 'btn',
  confirmLabel = 'Tap again to confirm',
  onConfirm,
  disabled,
  children,
}: {
  className?: string
  confirmLabel?: ReactNode
  onConfirm: () => void | Promise<void>
  disabled?: boolean
  children: ReactNode
}) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={armed ? `${className} danger` : className}
      disabled={disabled || busy}
      onClick={async () => {
        if (!armed) return setArmed(true)
        setArmed(false)
        setBusy(true)
        try {
          await onConfirm()
        } finally {
          setBusy(false)
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}
