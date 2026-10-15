import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { sounds } from '../fx'
import { MOODS, dayKey, lastDays, moodForDay, moodInfo, parseDayKey } from '../logic'
import { useStore } from '../store'
import type { MoodLevel } from '../types'
import { DAY_NAMES, timeAgo } from '../util'
import './fun.css'

const NAVY = '#2f4a8a'

/** A kawaii kitty face for each feeling, on a colored disc. */
export function MoodFace({ level, size = 64 }: { level: MoodLevel; size?: number }) {
  const m = moodInfo(level)
  const flower = m.color === '#ff6fae' ? '#ffd84d' : '#ff6fae'
  const fur = '#a3a8c3'
  const line = { stroke: NAVY, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={m.label}>
      <circle cx="50" cy="50" r="48" fill={m.color} />
      {/* Lilo: grey tabby face with a hibiscus */}
      <path d="M22 44 L25 16 L45 30 Z" fill={fur} stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
      <path d="M78 44 L75 16 L55 30 Z" fill={fur} stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
      <path d="M27 38 L28 24 L39 31 Z" fill="#ffb3d9" />
      <path d="M73 38 L72 24 L61 31 Z" fill="#ffb3d9" />
      <ellipse cx="50" cy="57" rx="33" ry="26" fill={fur} stroke={NAVY} strokeWidth="3" />
      <path d="M44 33 L45 40 M50 32 L50 40 M56 33 L55 40" stroke="#7c8199" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="50" cy="68" rx="15" ry="10" fill="#eef0f8" />
      <g transform="translate(70 30)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="0" cy="-5.5" rx="4" ry="6" fill={flower} stroke={NAVY} strokeWidth="1.5" transform={`rotate(${r})`} />
        ))}
        <circle r="2.8" fill="#ffd84d" stroke={NAVY} strokeWidth="1.5" />
      </g>
      {/* whiskers */}
      <path d="M10 55 L24 58 M10 64 L24 63 M90 55 L76 58 M90 64 L76 63" {...line} strokeWidth={2.4} />
      {/* blush */}
      {level >= 3 && <circle cx="31" cy="66" r="5" fill="#ffb3d9" />}
      {level >= 3 && <circle cx="69" cy="66" r="5" fill="#ffb3d9" />}
      {/* nose */}
      <ellipse cx="50" cy="61" rx="3.6" ry="2.6" fill="#ffd84d" stroke={NAVY} strokeWidth="1.6" />

      {level === 1 && (
        <>
          <path d="M33 52 Q38 47 43 52 M57 52 Q62 47 67 52" {...line} />
          <path d="M42 73 Q50 66 58 73" {...line} />
          <path d="M66 56 Q62 63 66 67 Q70 63 66 56 Z" fill="#6ec6f0" stroke={NAVY} strokeWidth="1.6" />
        </>
      )}
      {level === 2 && (
        <>
          <path d="M31 45 L42 49 M69 45 L58 49" {...line} />
          <circle cx="38" cy="54" r="3.4" fill={NAVY} />
          <circle cx="62" cy="54" r="3.4" fill={NAVY} />
          <path d="M42 72 Q46 69 50 72 Q54 75 58 72" {...line} />
        </>
      )}
      {level === 3 && (
        <>
          <circle cx="38" cy="54" r="3.6" fill={NAVY} />
          <circle cx="62" cy="54" r="3.6" fill={NAVY} />
          <path d="M44 71 L56 71" {...line} />
        </>
      )}
      {level === 4 && (
        <>
          <circle cx="38" cy="54" r="4" fill={NAVY} />
          <circle cx="62" cy="54" r="4" fill={NAVY} />
          <circle cx="39.4" cy="52.6" r="1.3" fill="#fff" />
          <circle cx="63.4" cy="52.6" r="1.3" fill="#fff" />
          <path d="M42 68 Q46 73 50 68 Q54 73 58 68" {...line} />
        </>
      )}
      {level === 5 && (
        <>
          <path d="M38 47 L40 52 L45 52 L41 55 L43 60 L38 57 L33 60 L35 55 L31 52 L36 52 Z" fill="#ffd84d" stroke={NAVY} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M62 47 L64 52 L69 52 L65 55 L67 60 L62 57 L57 60 L59 55 L55 52 L60 52 Z" fill="#ffd84d" stroke={NAVY} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M41 67 Q50 80 59 67 Z" fill="#ff6fae" stroke={NAVY} strokeWidth="2.6" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

/** Maya's once-a-day "How do you feel?" card on her Home screen. */
export function MoodCheckIn({ onCheckedIn }: { onCheckedIn?: (level: MoodLevel, reply: string) => void }) {
  const { data, actions } = useStore()
  const today = dayKey()
  const current = moodForDay(data.moods, today)
  const [editing, setEditing] = useState(!current)
  const [picked, setPicked] = useState<MoodLevel | null>(current?.mood ?? null)
  const [note, setNote] = useState(current?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // A new day (or a check-in from another device) resets the card.
  useEffect(() => {
    setEditing(!current)
    setPicked(current?.mood ?? null)
    setNote(current?.note ?? '')
  }, [current?.id, current?.mood, current?.note, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!picked || busy) return
    setBusy(true)
    setErr('')
    try {
      await actions.checkInMood(picked, note)
      sounds.purr()
      setTimeout(() => sounds.sparkle(), 250)
      setEditing(false)
      onCheckedIn?.(picked, moodInfo(picked).reply)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (current && !editing) {
    const m = moodInfo(current.mood)
    return (
      <motion.section className="card fun-card mood-card done" layout>
        <motion.div
          className="mood-done-face"
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0, y: [0, -6, 0] }}
          transition={{ scale: { type: 'spring', stiffness: 300, damping: 12 }, y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <MoodFace level={current.mood} size={76} />
        </motion.div>
        <div className="fun-card-text grow">
          <strong>Today I feel {m.label.toLowerCase()}</strong>
          <small>{m.reply}</small>
          {current.note && <small className="mood-note">“{current.note}”</small>}
        </div>
        <button
          type="button"
          className="btn tiny ghost"
          onClick={() => {
            sounds.blip()
            setEditing(true)
          }}
        >
          Change
        </button>
      </motion.section>
    )
  }

  return (
    <motion.section className="card fun-card mood-card" layout>
      <h3 className="mood-q">
        How are you feeling today?{' '}
        <motion.span className="inline-wiggle" animate={{ rotate: [0, 18, -10, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}>
          💭
        </motion.span>
      </h3>
      <div className="mood-row" role="radiogroup" aria-label="How are you feeling?">
        {MOODS.map((m, i) => {
          const on = picked === m.level
          return (
            <motion.button
              key={m.level}
              type="button"
              role="radio"
              aria-checked={on}
              className={on ? 'mood-pick on' : 'mood-pick'}
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: on ? 1.18 : picked ? 0.88 : 1, y: 0, opacity: picked && !on ? 0.6 : 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 14, delay: picked ? 0 : i * 0.06 }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.8, rotate: i % 2 ? 8 : -8 }}
              onClick={() => {
                sounds.meow()
                setPicked(m.level)
              }}
            >
              <motion.span
                className="mood-face-wrap"
                animate={on ? { rotate: [0, -10, 10, -6, 0] } : { y: [0, -3, 0] }}
                transition={on ? { duration: 0.6 } : { duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
              >
                <MoodFace level={m.level} size={64} />
              </motion.span>
              <span className="mood-label">{m.label}</span>
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence>
        {picked && (
          <motion.div className="mood-send" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <input
              className="input"
              maxLength={140}
              placeholder="Want to tell Mom & Dad why? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <motion.button type="button" className="btn go" whileTap={{ scale: 0.9 }} disabled={busy} onClick={send}>
              {busy ? 'Sending…' : 'Send to Mom & Dad 💌'}
            </motion.button>
            {err && <p className="error">{err}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

/** Parent Inbox: how Maya feels today, and a little row for the last week. */
export function ParentMoodCard() {
  const { data } = useStore()
  const kid = data.settings.kidName
  const days = lastDays(7)
  const today = days[days.length - 1]
  const [sel, setSel] = useState(today)
  const shown = moodForDay(data.moods, sel)
  const isToday = sel === today
  return (
    <section className="card parent-mood">
      <h3>💗 How {kid} feels</h3>
      <div className="parent-mood-today">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${sel}-${shown?.mood ?? 'none'}`}
            initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          >
            {shown ? <MoodFace level={shown.mood} size={60} /> : <span className="mood-empty big">?</span>}
          </motion.div>
        </AnimatePresence>
        <div className="grow">
          {shown ? (
            <>
              <strong>
                {isToday ? 'Today' : DAY_NAMES[parseDayKey(sel).getDay()]}: {moodInfo(shown.mood).label}
              </strong>
              <small className="muted"> · {timeAgo(shown.updatedAt ?? shown.createdAt)}</small>
              {shown.note && <p className="quote">“{shown.note}”</p>}
              {shown.mood <= 2 && isToday && <small className="muted">A hug and a little one-on-one time could go a long way today.</small>}
            </>
          ) : (
            <small className="muted">{isToday ? `${kid} hasn't checked in yet today.` : 'No check-in that day.'}</small>
          )}
        </div>
      </div>
      <div className="mood-week">
        {days.map((d) => {
          const m = moodForDay(data.moods, d)
          return (
            <button type="button" key={d} className={d === sel ? 'mood-day on' : 'mood-day'} onClick={() => setSel(d)}>
              {m ? <MoodFace level={m.mood} size={32} /> : <span className="mood-empty" />}
              <small>{d === today ? 'Today' : DAY_NAMES[parseDayKey(d).getDay()]}</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}
