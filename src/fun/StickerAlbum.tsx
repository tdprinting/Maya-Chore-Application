import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Progress } from '../components'
import { sounds } from '../fx'
import { useStore } from '../store'
import {
  RARITY_LABEL,
  SEEN_EVENT,
  STICKERS,
  STICKER_THEMES,
  loadSeenStickers,
  saveSeenStickers,
  stickerCollection,
  type CollectedSticker,
  type Sticker,
  type StickerTheme,
} from './stickers'
import './fun.css'

const THEME_BY_ID: Record<string, StickerTheme> = Object.fromEntries(STICKER_THEMES.map((t) => [t.id, t]))

/** This device's peeled stickers, kept in sync across components. */
export function useSeenStickers(): [Set<string>, (id: string) => void] {
  const [seen, setSeen] = useState(loadSeenStickers)
  useEffect(() => {
    const refresh = () => setSeen(loadSeenStickers())
    window.addEventListener(SEEN_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(SEEN_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  const markSeen = (id: string) => {
    const next = new Set(loadSeenStickers())
    next.add(id)
    saveSeenStickers(next)
  }
  return [seen, markSeen]
}

export function useStickerCollection() {
  const { data } = useStore()
  return useMemo(() => stickerCollection(data.submissions), [data.submissions])
}

/** One die-cut sticker. */
export function StickerArt({ sticker, size = 84 }: { sticker: Sticker; size?: number }) {
  const theme = THEME_BY_ID[sticker.theme]
  return (
    <span className={`sticker ${sticker.rarity}`} style={{ width: size, height: size, ['--st-bg' as string]: theme.soft, ['--st-ink' as string]: theme.color }}>
      <span className="sticker-emoji" style={{ fontSize: size * 0.5 }}>
        {sticker.emoji}
      </span>
      {sticker.rarity === 'sparkly' && (
        <>
          <span className="shimmer" aria-hidden />
          <span className="twinkle t1" aria-hidden>
            ✦
          </span>
          <span className="twinkle t2" aria-hidden>
            ✦
          </span>
        </>
      )}
      {sticker.rarity === 'rare' && (
        <span className="rare-star" aria-hidden>
          ★
        </span>
      )}
    </span>
  )
}

function Slot({ sticker, owned, fresh, onPeel, onOpen, index }: { sticker: Sticker; owned?: CollectedSticker; fresh: boolean; onPeel: () => void; onOpen: () => void; index: number }) {
  const [peeling, setPeeling] = useState(false)
  if (!owned) {
    return (
      <motion.div className="sticker-slot locked" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: index * 0.04 }}>
        <span className="sticker-silhouette" aria-hidden>
          {sticker.emoji}
        </span>
        <span className="slot-q">?</span>
        <small>???</small>
      </motion.div>
    )
  }
  const covered = fresh && !peeling
  return (
    <motion.button
      type="button"
      className={`sticker-slot owned ${fresh ? 'fresh' : ''}`}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={covered ? { scale: 1, opacity: 1, rotate: [0, -4, 4, -2, 0] } : { scale: 1, opacity: 1 }}
      transition={covered ? { rotate: { duration: 0.6, repeat: Infinity, repeatDelay: 1.4 }, delay: index * 0.04 } : { delay: index * 0.04 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        if (covered) {
          setPeeling(true)
          sounds.whoosh()
          setTimeout(() => {
            sounds.unlock()
            if (sticker.rarity === 'sparkly') sounds.sparkle(0.25)
            onPeel()
          }, 380)
        } else {
          sounds.pop()
          onOpen()
        }
      }}
      aria-label={covered ? 'New sticker! Tap to peel' : sticker.name}
    >
      <motion.span
        className="slot-art"
        initial={false}
        animate={peeling ? { scale: [0.7, 1.3, 1], rotate: [0, -12, 8, 0] } : undefined}
        transition={{ duration: 0.7, delay: 0.3 }}
      >
        <StickerArt sticker={sticker} size={76} />
      </motion.span>
      {owned.count > 1 && <span className="sticker-count">×{owned.count}</span>}
      <small>{covered ? 'NEW!' : sticker.name}</small>
      <AnimatePresence>
        {covered && (
          <motion.span
            className="peel-cover"
            style={{ transformOrigin: '0% 0%' }}
            exit={{ rotate: [-4, -70], x: [0, -30], y: [-6, -90], opacity: [1, 0], scale: [1.04, 0.85] }}
            transition={{ duration: 0.6, ease: 'easeIn' }}
          >
            <span className="peel-q">?</span>
            <span className="peel-text">Peel me!</span>
            <span className="peel-corner" />
          </motion.span>
        )}
      </AnimatePresence>
      {peeling && (
        <motion.span className="peel-pop" initial={{ y: 0, opacity: 0, scale: 0.4 }} animate={{ y: -50, opacity: [0, 1, 0], scale: 1.1 }} transition={{ duration: 1.3, delay: 0.4 }}>
          {RARITY_LABEL[sticker.rarity]}
        </motion.span>
      )}
    </motion.button>
  )
}

function StickerZoom({ item, onClose }: { item: CollectedSticker | null; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div className="fun-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="sticker-zoom"
            initial={{ scale: 0.3, rotate: -25, y: 60 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            exit={{ scale: 0.3, rotate: 25, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            <motion.div animate={{ rotateY: [0, 18, -18, 0], y: [0, -8, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
              <StickerArt sticker={item.sticker} size={180} />
            </motion.div>
            <h2>{item.sticker.name}</h2>
            <span className={`rarity-chip ${item.sticker.rarity}`}>{RARITY_LABEL[item.sticker.rarity]}</span>
            <p className="muted">
              {THEME_BY_ID[item.sticker.theme].emoji} {THEME_BY_ID[item.sticker.theme].title} · You have {item.count}
            </p>
            <small className="muted">First found {new Date(item.firstAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</small>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Maya's sticker album: one page per theme, with peel-to-reveal for new stickers. */
export function StickerAlbum() {
  const collection = useStickerCollection()
  const [seen, markSeen] = useSeenStickers()
  const fresh = (id: string) => collection.has(id) && !seen.has(id)
  const firstFreshPage = STICKER_THEMES.findIndex((t) => STICKERS.some((s) => s.theme === t.id && fresh(s.id)))
  const [page, setPage] = useState(firstFreshPage >= 0 ? firstFreshPage : 0)
  const [dir, setDir] = useState(1)
  const [zoom, setZoom] = useState<CollectedSticker | null>(null)
  const theme = STICKER_THEMES[page]
  const onPage = STICKERS.filter((s) => s.theme === theme.id)
  const newCount = STICKERS.filter((s) => fresh(s.id)).length
  const ownedOnPage = onPage.filter((s) => collection.has(s.id)).length

  const go = (delta: number) => {
    sounds.whoosh(delta < 0)
    setDir(delta)
    setPage((p) => (p + delta + STICKER_THEMES.length) % STICKER_THEMES.length)
  }

  return (
    <div className="stack">
      <section className="card album-head">
        <div className="row">
          <motion.span className="album-icon" animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }} aria-hidden>
            📒
          </motion.span>
          <div className="grow">
            <h3>My Sticker Album</h3>
            <small className="muted">
              {collection.size} of {STICKERS.length} collected · every approved chore, bonus or school star gives a sticker!
            </small>
          </div>
        </div>
        <Progress value={collection.size} max={STICKERS.length} />
        <div className="rarity-legend">
          <span className="rarity-chip common">Common</span>
          <span className="rarity-chip rare">★ Rare</span>
          <span className="rarity-chip sparkly">✦ Sparkly</span>
          {newCount > 0 && (
            <motion.span className="rarity-chip new" animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>
              {newCount} new to peel!
            </motion.span>
          )}
        </div>
      </section>

      <div className="album-book">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={theme.id}
            className="album-page"
            style={{ ['--page' as string]: theme.soft, ['--page-ink' as string]: theme.color }}
            custom={dir}
            initial={{ rotateY: dir > 0 ? 75 : -75, opacity: 0, x: dir > 0 ? 60 : -60 }}
            animate={{ rotateY: 0, opacity: 1, x: 0 }}
            exit={{ rotateY: dir > 0 ? -75 : 75, opacity: 0, x: dir > 0 ? -60 : 60 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <header className="album-page-head">
              <span className="album-page-emoji">{theme.emoji}</span>
              <strong>{theme.title}</strong>
              <small>
                {ownedOnPage}/{onPage.length}
              </small>
            </header>
            <div className="sticker-grid">
              {onPage.map((s, i) => (
                <Slot
                  key={s.id}
                  index={i}
                  sticker={s}
                  owned={collection.get(s.id)}
                  fresh={fresh(s.id)}
                  onPeel={() => markSeen(s.id)}
                  onOpen={() => setZoom(collection.get(s.id) ?? null)}
                />
              ))}
            </div>
            {ownedOnPage === onPage.length && (
              <motion.div className="page-complete" initial={{ scale: 0 }} animate={{ scale: 1, rotate: -6 }} transition={{ type: 'spring', delay: 0.3 }}>
                Page complete! 🏅
              </motion.div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="album-nav">
        <motion.button type="button" className="btn" whileTap={{ scale: 0.85, x: -6 }} onClick={() => go(-1)} aria-label="Previous page">
          ◀
        </motion.button>
        <div className="album-dots">
          {STICKER_THEMES.map((t, i) => {
            const hasNew = STICKERS.some((s) => s.theme === t.id && fresh(s.id))
            return (
              <button
                type="button"
                key={t.id}
                className={`album-dot ${i === page ? 'on' : ''} ${hasNew ? 'new' : ''}`}
                onClick={() => {
                  if (i === page) return
                  sounds.blip()
                  setDir(i > page ? 1 : -1)
                  setPage(i)
                }}
                aria-label={t.title}
              >
                {t.emoji}
              </button>
            )
          })}
        </div>
        <motion.button type="button" className="btn" whileTap={{ scale: 0.85, x: 6 }} onClick={() => go(1)} aria-label="Next page">
          ▶
        </motion.button>
      </div>
      <StickerZoom item={zoom} onClose={() => setZoom(null)} />
    </div>
  )
}

/** Home screen peek at the album, with a bouncing "new!" badge. */
export function StickerTeaser({ onOpen }: { onOpen: () => void }) {
  const collection = useStickerCollection()
  const [seen] = useSeenStickers()
  const newCount = [...collection.keys()].filter((id) => !seen.has(id)).length
  const latest = [...collection.values()].sort((a, b) => b.firstAt.localeCompare(a.firstAt)).slice(0, 3)
  return (
    <motion.button
      type="button"
      className="card fun-card sticker-teaser"
      whileTap={{ scale: 0.94, rotate: 2 }}
      onClick={() => {
        sounds.pop()
        onOpen()
      }}
    >
      <span className="teaser-fan" aria-hidden>
        {latest.length ? (
          latest.map((c, i) => (
            <motion.span
              key={c.sticker.id}
              className="teaser-sticker"
              style={{ zIndex: 3 - i }}
              initial={{ rotate: 0, x: 0 }}
              animate={{ rotate: (i - 1) * 14, x: (i - 1) * 18, y: [0, -3, 0] }}
              transition={{ rotate: { type: 'spring' }, y: { duration: 2, repeat: Infinity, delay: i * 0.3 } }}
            >
              <StickerArt sticker={c.sticker} size={46} />
            </motion.span>
          ))
        ) : (
          <span className="teaser-empty">📒</span>
        )}
      </span>
      <span className="fun-card-text">
        <strong>Sticker Album</strong>
        <small>
          {collection.size} / {STICKERS.length} stickers
        </small>
      </span>
      {newCount > 0 && (
        <motion.span className="fun-badge new" animate={{ scale: [1, 1.2, 1], rotate: [0, -8, 8, 0] }} transition={{ duration: 1, repeat: Infinity }}>
          {newCount} NEW!
        </motion.span>
      )}
    </motion.button>
  )
}
