import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chat, useUnreadCount } from '../Chat'
import type { MascotMood } from '../art/Mascot'
import { Icon } from '../art/Icons'
import { DrawStudio } from '../draw/DrawStudio'
import { BigCelebration, Empty, FloatingPoints, Mascot, Modal, Photo, PhotoPicker, Progress, Stars, TabBar, Toasts, type Tab, type Toast } from '../components'
import { wordsForToday, noteForToday, randomCheer } from '../encouragement'
import { originOf, smallWin, bigWin, sounds } from '../fx'
import {
  badges,
  bonusQuests,
  bonusUsesThisWeek,
  choresForDay,
  dayKey,
  levelFor,
  lifetimeEarned,
  pointsFor,
  streak,
  submissionForDay,
  uid,
} from '../logic'
import { useStore } from '../store'
import type { Chore, Order, Prize, Submission } from '../types'
import { DAY_FULL, safeUrl, timeAgo } from '../util'

type KidTab = 'home' | 'chores' | 'bonus' | 'school' | 'shop' | 'draw' | 'chat' | 'trophies'

export function KidApp({ onGrownUps }: { onGrownUps: () => void }) {
  const { data, actions, events, dismissEvent } = useStore()
  const [tab, setTab] = useState<KidTab>('home')
  const tabRef = useRef(tab)
  tabRef.current = tab
  const unread = useUnreadCount('kid')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [floating, setFloating] = useState<{ id: string; text: string } | null>(null)

  const [buddy, setBuddy] = useState<{ mood: MascotMood; say?: string; id: number }>({ mood: 'wave', id: 0 })
  const react = useCallback((mood: MascotMood, say?: string) => setBuddy((b) => ({ mood, say, id: b.id + 1 })), [])
  // Lilo settles back to idle a few seconds after reacting.
  useEffect(() => {
    if (!buddy.id) return
    const t = setTimeout(() => setBuddy((b) => ({ mood: idleMood(), id: b.id })), 3500)
    return () => clearTimeout(t)
  }, [buddy.id])

  const pushToast = useCallback((t: Omit<Toast, 'id'>) => setToasts((ts) => [...ts, { ...t, id: uid() }]), [])
  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  // News from Mom & Dad's phones.
  useEffect(() => {
    for (const ev of events) {
      const item = ev.item
      const prev = ev.previous
      if (item.kind === 'submission' && prev?.kind === 'submission' && prev.status === 'pending') {
        if (item.status === 'approved') {
          smallWin()
          react('cheer', 'Woohoo! Stars for you!')
          setFloating({ id: uid(), text: `+${item.pointsAwarded} ⭐` })
          pushToast({ emoji: '🎉', title: `Approved: ${item.title}!`, body: item.parentNote || `You earned ${item.pointsAwarded} stars!` })
        } else if (item.status === 'rejected') {
          sounds.pop()
          pushToast({ emoji: '🔁', title: `Let's try again: ${item.title}`, body: item.parentNote || 'Check with Mom or Dad.' })
        }
      } else if (item.kind === 'order' && prev?.kind === 'order' && prev.status !== item.status) {
        const msg: Record<string, string> = {
          approved: 'is on the shopping list for payday!',
          purchased: 'has been bought!',
          delivered: 'is all yours! Enjoy!',
          declined: 'was not approved. Your stars came back.',
        }
        sounds.ding()
        pushToast({ emoji: item.emoji, title: item.title, body: msg[item.status] })
      } else if (item.kind === 'wish' && prev?.kind === 'wish' && prev.status !== item.status) {
        sounds.ding()
        pushToast({
          emoji: item.status === 'added' ? '🛍️' : '💭',
          title: item.status === 'added' ? `${item.title} is in the shop now!` : `${item.title} wasn't added`,
          body: item.parentNote,
        })
      } else if (item.kind === 'message' && !prev && item.from === 'parent') {
        sounds.chime()
        if (tabRef.current !== 'chat') pushToast({ emoji: '💬', title: `${item.author} says:`, body: item.sticker ?? item.text })
      } else if (item.kind === 'note' && !prev) {
        sounds.chime()
        react('love', 'A love note! 💖')
        pushToast({ emoji: '💌', title: `A love note from ${item.from}!`, body: item.text })
      } else if (item.kind === 'ledger' && !prev && !item.refId) {
        if (item.amount > 0) smallWin()
        pushToast({ emoji: item.emoji, title: `${item.amount > 0 ? '+' : ''}${item.amount} stars`, body: item.reason })
      }
      dismissEvent(ev.id)
    }
  }, [events, dismissEvent, pushToast, react])

  // The iPad stays open overnight: re-render when the date changes so "today" moves on.
  const [today, setToday] = useState(() => dayKey())
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    const t = setTimeout(() => setToday(dayKey()), midnight.getTime() - now.getTime())
    const onVisible = () => document.visibilityState === 'visible' && setToday(dayKey())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [today])

  const todays = choresForDay(data.chores)
  const todoCount = todays.filter((c) => !submissionForDay(data.submissions, c.id, today)).length

  const tabs: Tab<KidTab>[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'chores', label: 'Chores', icon: 'chores', badge: todoCount },
    { id: 'bonus', label: 'Bonus', icon: 'bonus' },
    { id: 'school', label: 'School', icon: 'school' },
    { id: 'shop', label: 'Prizes', icon: 'prizes' },
    { id: 'draw', label: 'Draw', icon: 'draw' },
    { id: 'chat', label: 'Chat', icon: 'chat', badge: unread },
    { id: 'trophies', label: 'Trophies', icon: 'trophies' },
  ]

  const onEarned = (text: string) => {
    setFloating({ id: uid(), text })
    react('cheer', randomCheer())
  }

  // Pop-ups render outside the app container, so the theme goes on <body> too.
  useEffect(() => {
    document.body.className = `kid theme-${data.settings.theme}`
  }, [data.settings.theme])

  return (
    <div className={`app kid theme-${data.settings.theme}`}>
      <div className="bg-bubbles" aria-hidden>
        {['🌺', '⭐', '🎀', '🐠', '🌊', '💖', '🌴', '✨'].map((e, i) => (
          <span key={i} style={{ left: `${(i * 13) % 100}%`, animationDelay: `${i * 1.7}s` }}>
            {e}
          </span>
        ))}
      </div>
      <header className="kid-header">
        <div className="kid-title">
          <span className="logo">🌺</span> {data.settings.kidName}'s {data.settings.currency}
        </div>
        <div className="row">
          <Stars n={data.balance} />
          <button type="button" className="btn tiny ghost" onClick={onGrownUps}>
            🔒 Grown-ups
          </button>
        </div>
      </header>
      <main className="kid-main">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
            {tab === 'home' && <KidHome goTo={setTab} />}
            {tab === 'chores' && <KidChores onEarned={onEarned} />}
            {tab === 'bonus' && <KidBonus onEarned={onEarned} />}
            {tab === 'school' && <KidSchool onEarned={onEarned} />}
            {tab === 'shop' && <KidShop />}
            {tab === 'draw' && (
              <DrawStudio
                kidName={data.settings.kidName}
                onSend={async (image, caption) => {
                  await actions.sendMessage('kid', data.settings.kidName, caption || 'I drew this for you! 🎨', undefined, image)
                  react('love', 'They will love it! 💖')
                }}
              />
            )}
            {tab === 'chat' && <Chat side="kid" />}
            {tab === 'trophies' && <KidTrophies />}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar tabs={tabs} current={tab} onChange={(t) => (sounds.pop(), setTab(t))} />
      {tab !== 'draw' && <Buddy mood={buddy.mood} say={buddy.say} sayKey={buddy.id} onTap={() => react(pick(['love', 'cheer', 'wink', 'wow'] as MascotMood[]), pick(BUDDY_LINES))} />}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      {floating && <FloatingPoints key={floating.id} text={floating.text} onDone={() => setFloating(null)} />}
    </div>
  )
}

const BUDDY_LINES = ['Meow! You are awesome!', 'Purr… I love you!', 'Want to do a bonus quest?', 'High paw! 🐾', 'You are so smart!', 'Let’s earn some stars!', 'Draw me something? 🎨']

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function idleMood(): MascotMood {
  const h = new Date().getHours()
  return h >= 20 || h < 6 ? 'sleepy' : 'happy'
}

/** Lilo hangs out in the corner and reacts to everything Maya does. */
function Buddy({ mood, say, sayKey, onTap }: { mood: MascotMood; say?: string; sayKey: number; onTap: () => void }) {
  return (
    <div className="buddy">
      <AnimatePresence>
        {say && (
          <motion.div
            key={sayKey}
            className="buddy-say"
            initial={{ opacity: 0, scale: 0.4, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            {say}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button type="button" className="buddy-btn" whileTap={{ scale: 0.8, rotate: -8 }} onClick={onTap} aria-label="Lilo the cat">
        <Mascot size={92} mood={mood} />
      </motion.button>
    </div>
  )
}

function KidHome({ goTo }: { goTo: (t: KidTab) => void }) {
  const { data } = useStore()
  const s = data.settings
  const today = dayKey()
  const todays = choresForDay(data.chores)
  const done = todays.filter((c) => submissionForDay(data.submissions, c.id, today)).length
  const days = streak(data.submissions)
  const lifetime = lifetimeEarned(data.ledger)
  const level = levelFor(lifetime)
  const goal = data.prizes.find((p) => p.id === s.goalPrizeId)
  const note = noteForToday(data.notes)
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Aloha' : 'Good evening'

  return (
    <div className="stack">
      <section className="hero card">
        <Mascot size={130} mood={done === todays.length && todays.length > 0 ? 'wow' : 'happy'} />
        <div>
          <h1 className="hello">
            {hello}, {s.kidName}! <span className="wave">👋</span>
          </h1>
          <motion.div className="bubble" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: 'spring' }}>
            <span className="bubble-label">Lilo's wise words for {DAY_FULL[new Date().getDay()]}</span>
            {wordsForToday(s.kidName)}
          </motion.div>
        </div>
      </section>

      {note && (
        <motion.section className="card love-note" initial={{ rotate: -3, y: 20, opacity: 0 }} animate={{ rotate: -1, y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
          <div className="love-note-head">💌 A note from {note.from}</div>
          <p>{note.text}</p>
        </motion.section>
      )}

      <div className="grid-2">
        <button type="button" className="card stat-card pink" onClick={() => goTo('chores')}>
          <div className="stat-emoji">
            <Icon name="chores" size={52} active />
          </div>
          <div className="stat-big">
            {done} / {todays.length}
          </div>
          <div>chores done today</div>
          <Progress value={done} max={todays.length} />
        </button>
        <div className="card stat-card blue">
          <div className="stat-emoji">
            <Icon name="fire" size={52} active={days > 0} />
          </div>
          <div className="stat-big">{days}</div>
          <div>{days === 1 ? 'day' : 'days'} helping in a row</div>
        </div>
        <button type="button" className="card stat-card yellow" onClick={() => goTo('trophies')}>
          <div className="stat-emoji">{level.emoji}</div>
          <div className="stat-mid">Level {level.level}</div>
          <div>{level.title}</div>
          {level.next > level.floor && <Progress value={lifetime - level.floor} max={level.next - level.floor} />}
        </button>
        <button type="button" className="card stat-card purple" onClick={() => goTo('shop')}>
          {goal ? (
            <>
              <div className="stat-emoji">{goal.emoji}</div>
              <div className="stat-mid">Saving for</div>
              <div className="clamp">{goal.title}</div>
              <Progress value={data.balance} max={goal.points} />
              <small>
                {Math.min(data.balance, goal.points)} / {goal.points} ⭐
              </small>
            </>
          ) : (
            <>
              <div className="stat-emoji">🎯</div>
              <div className="stat-mid">Pick a goal!</div>
              <div>Choose a prize to save for</div>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function statusChip(sub?: Submission) {
  if (!sub) return null
  if (sub.status === 'pending') return <span className="chip wait">⏳ Waiting for a grown-up</span>
  if (sub.status === 'approved') return <span className="chip ok">✅ +{sub.pointsAwarded} ⭐</span>
  return <span className="chip no">🔁 Try again</span>
}

function KidChores({ onEarned }: { onEarned: (t: string) => void }) {
  const { data } = useStore()
  const [open, setOpen] = useState<Chore | null>(null)
  const now = new Date()
  const today = dayKey(now)
  const todays = choresForDay(data.chores, now)
  const sorted = [...todays].sort((a, b) => {
    const sa = submissionForDay(data.submissions, a.id, today) ? 1 : 0
    const sb = submissionForDay(data.submissions, b.id, today) ? 1 : 0
    return sa - sb
  })
  const sentBack = data.submissions.filter((s) => s.type === 'chore' && s.date === today && s.status === 'rejected')
  const allDone = todays.length > 0 && todays.every((c) => submissionForDay(data.submissions, c.id, today))

  return (
    <div className="stack">
      <h2 className="section-title">✅ {DAY_FULL[now.getDay()]}'s Chores</h2>
      {allDone && (
        <motion.div className="card all-done" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <Mascot size={90} mood="wink" /> <div>All done for today! You are a superstar! 🌟</div>
        </motion.div>
      )}
      {!todays.length && <Empty emoji="🏖️">No chores today. Enjoy your day! Check the Bonus tab for extra stars.</Empty>}
      <div className="chore-grid">
        {sorted.map((c, i) => {
          const sub = submissionForDay(data.submissions, c.id, today)
          const rejected = !sub && sentBack.find((s) => s.choreId === c.id)
          return (
            <motion.button
              type="button"
              key={c.id}
              className={`chore-card ${sub ? 'done' : ''}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => !sub && setOpen(c)}
            >
              <span className="chore-emoji">{c.emoji}</span>
              <span className="chore-title">{c.title}</span>
              <span className="chore-points">
                ⭐ {c.points} <small>+{c.photoBonus} 📸</small>
              </span>
              {statusChip(sub)}
              {rejected && (
                <span className="chip no" title={rejected.parentNote}>
                  🔁 {rejected.parentNote || 'Try again'}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
      <ChoreDoneModal chore={open} onClose={() => setOpen(null)} onEarned={onEarned} />
      <WeekPeek />
    </div>
  )
}

function WeekPeek() {
  const { data } = useStore()
  const todayDow = new Date().getDay()
  return (
    <section className="card">
      <h3>📅 My week</h3>
      <div className="week-peek">
        {DAY_FULL.map((d, dow) => {
          const list = data.chores.filter((c) => c.type === 'chore' && c.days.includes(dow))
          return (
            <div key={d} className={dow === todayDow ? 'peek-day today' : 'peek-day'}>
              <strong>{d.slice(0, 3)}</strong>
              <div className="peek-emojis">{list.map((c) => c.emoji).join(' ') || '🏖️'}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ChoreDoneModal({ chore, onClose, onEarned }: { chore: Chore | null; onClose: () => void; onEarned: (t: string) => void }) {
  const { actions } = useStore()
  const [photo, setPhoto] = useState<Blob>()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    setPhoto(undefined)
    setNote('')
    setErr('')
  }, [chore])
  if (!chore) return <Modal open={false} onClose={onClose}>{null}</Modal>
  const total = pointsFor({ basePoints: chore.points, photoBonus: chore.photoBonus, photo: photo ? 'x' : undefined })
  return (
    <Modal open={!!chore} onClose={onClose}>
      <div className="modal-emoji">{chore.emoji}</div>
      <h2>{chore.title}</h2>
      {chore.description && <p className="muted">{chore.description}</p>}
      <div className="points-line">
        <span className="pill">⭐ {chore.points} stars</span>
        <span className={photo ? 'pill bonus on' : 'pill bonus'}>📸 +{chore.photoBonus} bonus with a picture</span>
      </div>
      <PhotoPicker value={photo} onChange={setPhoto} label="Add a picture for bonus stars" />
      <textarea className="input" placeholder="Want to tell Mom & Dad anything? (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      {err && <p className="error">{err}</p>}
      <motion.button
        type="button"
        className="btn big go"
        whileTap={{ scale: 0.9 }}
        disabled={busy}
        onClick={async (e) => {
          const origin = originOf(e.currentTarget)
          setBusy(true)
          try {
            await actions.submitChore(chore, photo, note)
            smallWin(origin)
            onEarned(`${randomCheer()} ${total} ⭐`)
            onClose()
          } catch (x) {
            setErr((x as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Sending…' : `I did it! 🎉 (${total} ⭐)`}
      </motion.button>
      <p className="muted small">Mom or Dad will check it and send your stars.</p>
    </Modal>
  )
}

function KidBonus({ onEarned }: { onEarned: (t: string) => void }) {
  const { data } = useStore()
  const [open, setOpen] = useState<Chore | null>(null)
  const quests = bonusQuests(data.chores)
  return (
    <div className="stack">
      <h2 className="section-title">🚀 Bonus Quests</h2>
      <p className="muted">Extra ways to earn stars this week. Pictures earn even more!</p>
      {!quests.length && <Empty emoji="🛸">No bonus quests yet. Ask Mom or Dad to add some!</Empty>}
      <div className="chore-grid">
        {quests.map((q, i) => {
          const used = bonusUsesThisWeek(data.submissions, q.id)
          const max = q.perWeek ?? 1
          const full = used >= max
          return (
            <motion.button
              type="button"
              key={q.id}
              className={`chore-card bonus ${full ? 'done' : ''}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => !full && setOpen(q)}
            >
              <span className="chore-emoji">{q.emoji}</span>
              <span className="chore-title">{q.title}</span>
              <span className="chore-points">
                ⭐ {q.points} <small>+{q.photoBonus} 📸</small>
              </span>
              <span className={full ? 'chip ok' : 'chip'}>
                {full ? '🌟 Maxed out this week!' : `${used} of ${max} this week`}
              </span>
            </motion.button>
          )
        })}
      </div>
      <ChoreDoneModal chore={open} onClose={() => setOpen(null)} onEarned={onEarned} />
    </div>
  )
}

function KidSchool({ onEarned }: { onEarned: (t: string) => void }) {
  const { data, actions } = useStore()
  const [photo, setPhoto] = useState<Blob>()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const mine = data.submissions.filter((s) => s.type === 'homework')
  return (
    <div className="stack">
      <h2 className="section-title">🧠 School Stars</h2>
      <section className="card">
        <p>Did you do something awesome at school? A great test, a cool project, a perfect spelling list? Show us and earn bonus stars!</p>
        <input className="input" placeholder="What is it? (like: Math test 100%!)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <PhotoPicker value={photo} onChange={setPhoto} label="Take a picture of your work" />
        <textarea className="input" placeholder="Tell us about it! (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <motion.button
          type="button"
          className="btn big go"
          whileTap={{ scale: 0.9 }}
          disabled={!photo || busy}
          onClick={async (e) => {
            if (!photo) return
            const origin = originOf(e.currentTarget)
            setBusy(true)
            setErr('')
            try {
              await actions.submitHomework(title, photo, note)
              smallWin(origin)
              onEarned('Brainiac! 🧠')
              setPhoto(undefined)
              setTitle('')
              setNote('')
            } catch (x) {
              setErr((x as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Sending…' : 'Send to Mom & Dad 🚀'}
        </motion.button>
        {err && <p className="error">{err}</p>}
      </section>
      {mine.length > 0 && <h3>My school stars</h3>}
      <div className="list">
        {mine.map((s) => (
          <div key={s.id} className="list-row card">
            <Photo src={s.photo} alt={s.title} className="thumb" />
            <div className="grow">
              <strong>{s.title}</strong>
              <small className="muted">{timeAgo(s.createdAt)}</small>
              {s.parentNote && <small>💬 {s.parentNote}</small>}
            </div>
            {statusChip(s)}
          </div>
        ))}
      </div>
    </div>
  )
}

function KidShop() {
  const { data, actions } = useStore()
  const [open, setOpen] = useState<Prize | null>(null)
  const [party, setParty] = useState<Order | null>(null)
  const [wishOpen, setWishOpen] = useState(false)
  const [view, setView] = useState<'shop' | 'mine'>('shop')
  const [buying, setBuying] = useState(false)
  const [buyErr, setBuyErr] = useState('')
  const prizes = data.prizes.filter((p) => p.active)
  const goalId = data.settings.goalPrizeId

  return (
    <div className="stack">
      <div className="shop-head">
        <h2 className="section-title">🎁 Prize Shop</h2>
        <Stars n={data.balance} big />
      </div>
      <div className="seg">
        <button type="button" className={view === 'shop' ? 'on' : ''} onClick={() => setView('shop')}>
          🛍️ Shop
        </button>
        <button type="button" className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>
          📦 My prizes & wishes
        </button>
      </div>
      {view === 'shop' ? (
        <>
          <div className="prize-grid">
            {prizes.map((p, i) => {
              const afford = data.balance >= p.points
              return (
                <motion.button
                  type="button"
                  key={p.id}
                  className={`prize-card ${afford ? 'afford' : ''} ${goalId === p.id ? 'goal' : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setOpen(p)}
                >
                  {goalId === p.id && <span className="goal-ribbon">🎯 My goal</span>}
                  {p.photo ? <Photo src={p.photo} alt={p.title} className="prize-photo" /> : <span className="prize-emoji">{p.emoji}</span>}
                  <span className="prize-title">{p.title}</span>
                  <span className="prize-cost">⭐ {p.points}</span>
                  {!afford && <Progress value={data.balance} max={p.points} />}
                </motion.button>
              )
            })}
            <motion.button type="button" className="prize-card wish-card" whileTap={{ scale: 0.95 }} onClick={() => setWishOpen(true)}>
              <span className="prize-emoji">🔍</span>
              <span className="prize-title">Found something cool online?</span>
              <span className="prize-cost">Ask to add it!</span>
            </motion.button>
          </div>
        </>
      ) : (
        <MyPrizes />
      )}

      <Modal
        open={!!open}
        onClose={() => {
          setOpen(null)
          setBuyErr('')
        }}
      >
        {open && (
          <>
            {open.photo ? <Photo src={open.photo} alt={open.title} className="modal-photo" /> : <div className="modal-emoji">{open.emoji}</div>}
            <h2>{open.title}</h2>
            {open.description && <p className="muted">{open.description}</p>}
            <div className="points-line">
              <span className="pill">⭐ {open.points} stars</span>
              <span className="pill">You have ⭐ {data.balance}</span>
            </div>
            {data.balance >= open.points ? (
              <motion.button
                type="button"
                className="btn big go"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                disabled={buying}
                onClick={async () => {
                  if (buying) return
                  setBuying(true)
                  setBuyErr('')
                  try {
                    const order = await actions.buyPrize(open)
                    setOpen(null)
                    bigWin()
                    setParty(order)
                  } catch (e) {
                    setBuyErr((e as Error).message)
                  } finally {
                    setBuying(false)
                  }
                }}
              >
                {buying ? 'Sending…' : 'Get it! 🎉'}
              </motion.button>
            ) : (
              <>
                <Progress value={data.balance} max={open.points} />
                <p className="center">Only ⭐ {open.points - data.balance} more stars to go! You can do it! 💪</p>
                {goalId !== open.id && (
                  <button
                    type="button"
                    className="btn big"
                    onClick={() => {
                      void actions.updateSettings({ goalPrizeId: open.id })
                      sounds.chime()
                      setOpen(null)
                    }}
                  >
                    🎯 Make this my goal
                  </button>
                )}
              </>
            )}
            {buyErr && <p className="error">{buyErr}</p>}
          </>
        )}
      </Modal>

      <WishModal open={wishOpen} onClose={() => setWishOpen(false)} />

      <BigCelebration
        show={!!party}
        emoji={party?.emoji ?? '🎁'}
        title={`YOU DID IT, ${data.settings.kidName.toUpperCase()}!`}
        subtitle={`You saved up and earned ${party?.title}! Mom & Dad will get it on payday. We are SO proud of you!`}
        onDone={() => setParty(null)}
      />
    </div>
  )
}

const ORDER_LABEL: Record<Order['status'], string> = {
  requested: '📨 Sent to Mom & Dad',
  approved: '💰 On the payday list',
  purchased: '🛍️ Bought!',
  delivered: '🎉 It’s yours!',
  declined: '↩️ Stars returned',
}

function MyPrizes() {
  const { data } = useStore()
  return (
    <div className="stack">
      <h3>📦 My prizes</h3>
      {!data.orders.length && <Empty emoji="🛍️">No prizes yet. Keep earning stars!</Empty>}
      <div className="list">
        {data.orders.map((o) => (
          <div key={o.id} className="list-row card">
            <span className="row-emoji">{o.emoji}</span>
            <div className="grow">
              <strong>{o.title}</strong>
              <small className="muted">
                ⭐ {o.points} · {timeAgo(o.createdAt)}
              </small>
              {o.parentNote && <small>💬 {o.parentNote}</small>}
            </div>
            <span className={`chip status-${o.status}`}>{ORDER_LABEL[o.status]}</span>
          </div>
        ))}
      </div>
      <h3>💭 My wishes</h3>
      {!data.wishes.length && <Empty emoji="🔍">Find something online and send it to Mom & Dad!</Empty>}
      <div className="list">
        {data.wishes.map((w) => (
          <div key={w.id} className="list-row card">
            {w.photo ? <Photo src={w.photo} alt={w.title} className="thumb" /> : <span className="row-emoji">💭</span>}
            <div className="grow">
              <strong>{w.title}</strong>
              {w.parentNote && <small>💬 {w.parentNote}</small>}
            </div>
            <span className={`chip ${w.status === 'added' ? 'ok' : w.status === 'declined' ? 'no' : 'wait'}`}>
              {w.status === 'added' ? '🛍️ In the shop!' : w.status === 'declined' ? '💭 Not this time' : '⏳ Waiting'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WishModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useStore()
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<Blob>()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const reset = () => {
    setTitle('')
    setLink('')
    setPrice('')
    setNote('')
    setPhoto(undefined)
  }
  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-emoji">🔍</div>
      <h2>Wish list</h2>
      <p className="muted">Found something you love online? Send it to Mom & Dad. If they say yes, it goes in your prize shop!</p>
      <input className="input" placeholder="What is it?" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="input" placeholder="Paste the link (optional)" value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" />
      <input className="input" placeholder="How much does it cost? (optional)" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
      <textarea className="input" placeholder="Why do you love it?" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <PhotoPicker value={photo} onChange={setPhoto} label="Add a picture or screenshot" />
      <motion.button
        type="button"
        className="btn big go"
        disabled={!title.trim() || busy}
        whileTap={{ scale: 0.9 }}
        onClick={async (e) => {
          const origin = originOf(e.currentTarget)
          setBusy(true)
          setErr('')
          try {
            await actions.submitWish({ title: title.trim(), link: safeUrl(link), price: parseFloat(price.replace(/[^0-9.]/g, '')) || undefined, note, photo })
            smallWin(origin)
            reset()
            onClose()
          } catch (x) {
            setErr((x as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Sending…' : 'Send my wish 💫'}
      </motion.button>
      {err && <p className="error">{err}</p>}
    </Modal>
  )
}

function KidTrophies() {
  const { data, actions } = useStore()
  const days = streak(data.submissions)
  const lifetime = lifetimeEarned(data.ledger)
  const level = levelFor(lifetime)
  const list = useMemo(() => badges(data.submissions, data.chores, data.orders, days), [data.submissions, data.chores, data.orders, days])
  const earned = list.filter((b) => b.earned).length
  return (
    <div className="stack">
      <h2 className="section-title">🏆 My Trophies</h2>
      <section className="card level-card">
        <motion.div className="level-emoji" animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}>
          {level.emoji}
        </motion.div>
        <div className="grow">
          <h3>
            Level {level.level}: {level.title}
          </h3>
          <p className="muted">⭐ {lifetime} stars earned all time</p>
          {level.next > level.floor ? (
            <>
              <Progress value={lifetime - level.floor} max={level.next - level.floor} />
              <small>{level.next - lifetime} stars to the next level!</small>
            </>
          ) : (
            <small>You reached the top level! Legendary! 👑</small>
          )}
        </div>
      </section>

      <h3>
        Badges ({earned}/{list.length})
      </h3>
      <div className="badge-grid">
        {list.map((b) => (
          <motion.div key={b.id} className={b.earned ? 'badge-card earned' : 'badge-card'} whileHover={{ scale: 1.05 }}>
            <div className="badge-emoji">{b.emoji}</div>
            <strong>{b.title}</strong>
            <small>{b.description}</small>
            {!b.earned && <Progress value={b.progress} max={b.goal} />}
          </motion.div>
        ))}
      </div>

      <section className="card">
        <h3>🎨 My colors</h3>
        <div className="seg">
          <button type="button" className={data.settings.theme === 'kitty' ? 'on' : ''} onClick={() => actions.updateSettings({ theme: 'kitty' })}>
            🎀 Kitty Pink
          </button>
          <button type="button" className={data.settings.theme === 'ohana' ? 'on' : ''} onClick={() => actions.updateSettings({ theme: 'ohana' })}>
            🌊 Ohana Blue
          </button>
        </div>
      </section>

      <section className="card">
        <h3>📜 My star history</h3>
        <div className="list">
          {data.ledger.slice(0, 30).map((e) => (
            <div key={e.id} className="history-row">
              <span>{e.emoji}</span>
              <span className="grow">{e.reason}</span>
              <span className={e.amount >= 0 ? 'plus' : 'minus'}>
                {e.amount >= 0 ? '+' : ''}
                {e.amount}
              </span>
            </div>
          ))}
          {!data.ledger.length && <p className="muted">Your stars will show up here.</p>}
        </div>
      </section>
    </div>
  )
}

