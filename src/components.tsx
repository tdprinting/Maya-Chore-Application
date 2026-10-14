import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from './store'
import { compressImage } from './util'

/** Lilo, the family cat, as Maya's cheerleader: a pink-bowed kitty with a hibiscus. */
export function Mascot({ size = 120, mood = 'happy' }: { size?: number; mood?: 'happy' | 'wow' | 'wink' }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      animate={{ y: [0, -6, 0], rotate: [0, -2, 2, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      aria-label="Lilo the cat"
      role="img"
    >
      <ellipse cx="100" cy="185" rx="55" ry="8" fill="rgba(0,0,0,0.08)" />
      <path d="M40 70 L52 18 L88 52 Z" fill="#6b6f8c" />
      <path d="M160 70 L148 18 L112 52 Z" fill="#6b6f8c" />
      <path d="M50 60 L56 32 L76 52 Z" fill="#ffb3d9" />
      <path d="M150 60 L144 32 L124 52 Z" fill="#ffb3d9" />
      <ellipse cx="100" cy="105" rx="72" ry="66" fill="#7d82a3" />
      <ellipse cx="100" cy="128" rx="40" ry="30" fill="#e9ebf5" />
      {mood === 'wink' ? (
        <>
          <path d="M60 98 Q72 88 84 98" stroke="#2a2d43" strokeWidth="6" fill="none" strokeLinecap="round" />
          <ellipse cx="132" cy="98" rx="11" ry="14" fill="#2a2d43" />
          <circle cx="136" cy="93" r="4" fill="#fff" />
        </>
      ) : (
        <>
          <ellipse cx="72" cy="98" rx={mood === 'wow' ? 13 : 11} ry={mood === 'wow' ? 16 : 14} fill="#2a2d43" />
          <ellipse cx="128" cy="98" rx={mood === 'wow' ? 13 : 11} ry={mood === 'wow' ? 16 : 14} fill="#2a2d43" />
          <circle cx="76" cy="93" r="4" fill="#fff" />
          <circle cx="132" cy="93" r="4" fill="#fff" />
        </>
      )}
      <ellipse cx="100" cy="118" rx="7" ry="5" fill="#ff6fae" />
      {mood === 'wow' ? (
        <ellipse cx="100" cy="136" rx="9" ry="11" fill="#c2185b" />
      ) : (
        <path d="M88 128 Q100 140 112 128" stroke="#2a2d43" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      <g stroke="#2a2d43" strokeWidth="3" strokeLinecap="round">
        <line x1="30" y1="115" x2="62" y2="120" />
        <line x1="30" y1="130" x2="62" y2="128" />
        <line x1="170" y1="115" x2="138" y2="120" />
        <line x1="170" y1="130" x2="138" y2="128" />
      </g>
      <circle cx="56" cy="122" r="8" fill="#ffb3d9" opacity="0.7" />
      <circle cx="144" cy="122" r="8" fill="#ffb3d9" opacity="0.7" />
      {/* bow */}
      <g transform="translate(140 52) rotate(18)">
        <path d="M0 0 L-26 -16 L-26 16 Z" fill="#ff3d8b" />
        <path d="M0 0 L26 -16 L26 16 Z" fill="#ff3d8b" />
        <circle cx="0" cy="0" r="8" fill="#ff8fc0" />
      </g>
      {/* hibiscus */}
      <g transform="translate(56 50)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="0" cy="-10" rx="7" ry="11" fill="#4fc3f7" transform={`rotate(${r})`} />
        ))}
        <circle r="4" fill="#ffe066" />
      </g>
    </motion.svg>
  )
}

export function Stars({ n, big }: { n: number; big?: boolean }) {
  return (
    <span className={big ? 'stars stars-big' : 'stars'}>
      <span className="star-icon">⭐</span>
      <AnimatedNumber value={n} />
    </span>
  )
}

export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    const dur = 900
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(a + (value - a) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
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
          } finally {
            setBusy(false)
          }
        }}
      />
      {preview ? (
        <div className="photo-preview">
          <img src={preview} alt="Your picture" />
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => input.current?.click()}>
              🔄 Retake
            </button>
            <button type="button" className="btn ghost" onClick={() => onChange(undefined)}>
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
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className={wide ? 'modal wide' : 'modal'}
            initial={{ scale: 0.7, y: 60, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** The giant "you bought it!" party screen. */
export function BigCelebration({ show, emoji, title, subtitle, onDone }: { show: boolean; emoji: string; title: string; subtitle: string; onDone: () => void }) {
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div className="celebration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onDone}>
          <div className="rays" />
          <motion.div
            className="celebration-emoji"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: [0, 1.6, 1.2], rotate: [-180, 20, 0] }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          >
            <motion.span animate={{ y: [0, -24, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: 1.1 }} style={{ display: 'inline-block' }}>
              {emoji}
            </motion.span>
          </motion.div>
          <motion.h1 className="celebration-title" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6, type: 'spring' }}>
            {title}
          </motion.h1>
          <motion.p className="celebration-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
            {subtitle}
          </motion.p>
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6 }}>
            <Mascot size={150} mood="wow" />
          </motion.div>
          <motion.button className="btn big" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} onClick={onDone}>
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
  return (
    <motion.div
      className="floating-points"
      initial={{ y: 0, opacity: 0, scale: 0.5 }}
      animate={{ y: -160, opacity: [0, 1, 1, 0], scale: [0.5, 1.4, 1.2, 1] }}
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
  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => onDismiss(toasts[0].id), 5000)
    return () => clearTimeout(t)
  }, [toasts, onDismiss])
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.slice(0, 3).map((t) => (
          <motion.button
            key={t.id}
            layout
            className="toast"
            initial={{ y: -60, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ x: 300, opacity: 0 }}
            onClick={() => onDismiss(t.id)}
          >
            <span className="toast-emoji">{t.emoji}</span>
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
  icon: string
  badge?: number
}

export function TabBar<T extends string>({ tabs, current, onChange }: { tabs: Tab<T>[]; current: T; onChange: (t: T) => void }) {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <button key={t.id} type="button" className={t.id === current ? 'tab active' : 'tab'} onClick={() => onChange(t.id)}>
          <motion.span className="tab-icon" animate={t.id === current ? { scale: [1, 1.3, 1.1], rotate: [0, -10, 0] } : { scale: 1 }}>
            {t.icon}
          </motion.span>
          <span className="tab-label">{t.label}</span>
          {!!t.badge && <span className="badge">{t.badge}</span>}
        </button>
      ))}
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

export function Progress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="progress" aria-label={label}>
      <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
    </div>
  )
}
