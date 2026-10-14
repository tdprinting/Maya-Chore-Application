import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chat, useUnreadCount } from '../Chat'
import { Empty, Modal, Photo, Stars, TabBar, Toasts, type Tab, type Toast } from '../components'
import { sounds } from '../fx'
import { EFFORT_LABELS, STARS_PER_DOLLAR, dayKey, nowIso, sameWeek, streak, weekStartKey, pointsFor, suggestPhotoBonus, suggestPoints, suggestPrizePoints, uid } from '../logic'
import { CATEGORY_LABELS, EMOJI_CHOICES } from '../seed'
import { useStore } from '../store'
import { DevMode } from './DevMode'
import { quoteFor, tipFor } from './tips'
import type { Chore, ChoreCategory, Effort, Order, Prize, Submission, Wish } from '../types'
import { DAY_FULL, DAY_NAMES, hashPin, money, safeUrl, setBadge, timeAgo } from '../util'

type ParentTab = 'inbox' | 'chat' | 'schedule' | 'catalog' | 'prizes' | 'family'

export function ParentApp({ onKidView, canLeaveToKid }: { onKidView: () => void; canLeaveToKid: boolean }) {
  const { data, events, dismissEvent } = useStore()
  const [tab, setTab] = useState<ParentTab>('inbox')
  const tabRef = useRef(tab)
  tabRef.current = tab
  const unread = useUnreadCount('parent')
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  const pendingSubs = data.submissions.filter((s) => s.status === 'pending')
  const pendingOrders = data.orders.filter((o) => o.status === 'requested')
  const pendingWishes = data.wishes.filter((w) => w.status === 'pending')
  const inboxCount = pendingSubs.length + pendingOrders.length + pendingWishes.length
  const kid = data.settings.kidName

  useEffect(() => setBadge(inboxCount + unread), [inboxCount, unread])
  useEffect(() => {
    document.body.className = 'parent'
  }, [])

  useEffect(() => {
    for (const ev of events) {
      const it = ev.item
      let toast: Omit<Toast, 'id'> | null = null
      if (it.kind === 'submission' && !ev.previous && it.status === 'pending') {
        toast = {
          emoji: it.emoji,
          title: it.type === 'homework' ? `${kid} shared school work!` : `${kid} finished: ${it.title}`,
          body: it.photo ? '📸 With a picture. Tap Inbox to approve.' : 'Tap Inbox to approve.',
        }
      } else if (it.kind === 'order' && !ev.previous) {
        toast = { emoji: '🎁', title: `${kid} bought ${it.title}!`, body: `⭐ ${it.points}. Add it to the payday list.` }
      } else if (it.kind === 'message' && !ev.previous && it.from === 'kid') {
        if (tabRef.current === 'chat') sounds.pop()
        else toast = { emoji: '💬', title: `${kid} says:`, body: it.sticker ?? it.text }
      } else if (it.kind === 'wish' && !ev.previous) {
        toast = { emoji: '💭', title: `${kid} wished for ${it.title}`, body: 'Review it in the Inbox.' }
      }
      if (toast) {
        sounds.ding()
        const t = toast
        setToasts((ts) => [...ts, { ...t, id: uid() }])
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          try {
            new Notification(t.title, { body: t.body, icon: '/icon-192.png' })
          } catch {
            /* iOS only allows notifications from the service worker */
          }
        }
      }
      dismissEvent(ev.id)
    }
  }, [events, dismissEvent, kid])

  const tabs: Tab<ParentTab>[] = [
    { id: 'inbox', label: 'Inbox', icon: 'inbox', badge: inboxCount },
    { id: 'chat', label: 'Chat', icon: 'chat', badge: unread },
    { id: 'schedule', label: 'Schedule', icon: 'schedule' },
    { id: 'catalog', label: 'Chores', icon: 'catalog' },
    { id: 'prizes', label: 'Prizes', icon: 'prizes', badge: data.orders.filter((o) => o.status === 'approved').length },
    { id: 'family', label: 'Family', icon: 'family' },
  ]

  return (
    <div className="app parent">
      <header className="parent-header">
        <div>
          <div className="parent-title">Parent Hub</div>
          <small className="muted">
            {kid} has <Stars n={data.balance} />
          </small>
        </div>
        <button type="button" className="btn tiny ghost" onClick={onKidView}>
          {canLeaveToKid ? `🎀 Back to ${kid}` : `👀 ${kid}'s view`}
        </button>
      </header>
      <main className="parent-main">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.18 }}>
            {tab === 'inbox' && <Inbox />}
            {tab === 'schedule' && <Schedule />}
            {tab === 'catalog' && <Catalog />}
            {tab === 'prizes' && <Prizes />}
            {tab === 'chat' && <Chat side="parent" />}
            {tab === 'family' && <Family />}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar tabs={tabs} current={tab} onChange={setTab} />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

// ---------------------------------------------------------------------------

function ParentToday() {
  const { data } = useStore()
  const [offset, setOffset] = useState(0)
  const tip = tipFor(offset)
  const kid = data.settings.kidName
  const week = useMemo(() => {
    const thisWeek = data.submissions.filter((x) => sameWeek(x.date))
    const approved = thisWeek.filter((x) => x.status === 'approved')
    const ws = weekStartKey()
    const ledgerWeek = data.ledger.filter((e) => dayKey(new Date(e.createdAt)) >= ws)
    return {
      chores: approved.filter((x) => x.type === 'chore').length,
      bonus: approved.filter((x) => x.type === 'bonus').length,
      school: approved.filter((x) => x.type === 'homework').length,
      photos: approved.filter((x) => x.photo).length,
      earned: ledgerWeek.filter((e) => e.amount > 0 && !e.refId?.startsWith('refund:')).reduce((a, e) => a + e.amount, 0),
      spent: -ledgerWeek.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0),
      streak: streak(data.submissions),
    }
  }, [data.submissions, data.ledger])
  return (
    <>
      <motion.section className="card quote-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <span className="quote-mark">“</span>
        <p>{quoteFor()}</p>
      </motion.section>
      <section className="card tip-card">
        <div className="tip-head">
          <span className="cat-label">💡 Parenting tip</span>
          <button type="button" className="btn tiny ghost" onClick={() => setOffset((o) => o + 1)}>
            Another tip
          </button>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={tip.title} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <strong>{tip.title}</strong>
            <p className="muted">{tip.body}</p>
          </motion.div>
        </AnimatePresence>
      </section>
      <section className="card">
        <h3>📊 {kid}'s week so far</h3>
        <div className="week-stats">
          <div><strong>{week.chores}</strong><small>chores</small></div>
          <div><strong>{week.bonus}</strong><small>bonus quests</small></div>
          <div><strong>{week.school}</strong><small>school stars</small></div>
          <div><strong>{week.photos}</strong><small>photos</small></div>
          <div><strong>+{week.earned}</strong><small>stars earned</small></div>
          <div><strong>{week.spent}</strong><small>stars spent</small></div>
          <div><strong>🔥 {week.streak}</strong><small>day streak</small></div>
        </div>
      </section>
    </>
  )
}

function Inbox() {
  const { data, actions } = useStore()
  const [approvingAll, setApprovingAll] = useState(false)
  const subs = data.submissions.filter((s) => s.status === 'pending')
  const orders = data.orders.filter((o) => o.status === 'requested')
  const wishes = data.wishes.filter((w) => w.status === 'pending')
  const recent = data.submissions.filter((s) => s.status !== 'pending').slice(0, 8)
  const nothing = !subs.length && !orders.length && !wishes.length
  return (
    <div className="stack">
      {nothing && <Empty emoji="🌴">All caught up! New chores, prize picks and wishes from {data.settings.kidName} show up here instantly.</Empty>}
      {subs.length > 0 && (
        <div className="row">
          <h2 className="section-title grow">✅ To approve ({subs.length})</h2>
          {subs.length > 1 && (
            <button
              type="button"
              className="btn tiny go"
              disabled={approvingAll}
              onClick={async () => {
                setApprovingAll(true)
                for (const x of subs) await actions.approveSubmission(x, pointsFor(x))
                sounds.chime()
                setApprovingAll(false)
              }}
            >
              ✅ Approve all
            </button>
          )}
        </div>
      )}
      <AnimatePresence>
        {subs.map((s) => (
          <SubmissionCard key={s.id} sub={s} />
        ))}
      </AnimatePresence>
      {orders.length > 0 && <h2 className="section-title">🎁 Prize picks ({orders.length})</h2>}
      {orders.map((o) => (
        <OrderRequestCard key={o.id} order={o} />
      ))}
      {wishes.length > 0 && <h2 className="section-title">💭 Wish list requests ({wishes.length})</h2>}
      {wishes.map((w) => (
        <WishCard key={w.id} wish={w} />
      ))}
      <ParentToday />
      {recent.length > 0 && (
        <section className="card">
          <h3>Recently reviewed</h3>
          {recent.map((s) => (
            <div key={s.id} className="history-row">
              <span>{s.emoji}</span>
              <span className="grow">
                {s.title} <small className="muted">· {timeAgo(s.reviewedAt ?? s.createdAt)}</small>
              </span>
              <span className={s.status === 'approved' ? 'plus' : 'minus'}>{s.status === 'approved' ? `+${s.pointsAwarded}` : 'sent back'}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function SubmissionCard({ sub }: { sub: Submission }) {
  const { actions } = useStore()
  const [points, setPoints] = useState(pointsFor(sub))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const label = sub.type === 'homework' ? 'School star' : sub.type === 'bonus' ? 'Bonus quest' : 'Chore'
  return (
    <motion.section className="card review-card" layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 200 }}>
      <div className="review-head">
        <span className="row-emoji">{sub.emoji}</span>
        <div className="grow">
          <strong>{sub.title}</strong>
          <small className="muted">
            {label} · {timeAgo(sub.createdAt)}
          </small>
        </div>
      </div>
      {sub.photo && <Photo src={sub.photo} alt={sub.title} className="review-photo" />}
      {sub.note && <p className="quote">“{sub.note}”</p>}
      <div className="points-edit">
        <label>
          Stars
          <input type="number" className="input small" value={points} min={0} onChange={(e) => setPoints(Math.max(0, parseInt(e.target.value) || 0))} />
        </label>
        <small className="muted">
          {sub.basePoints} base{sub.photo && sub.photoBonus ? ` + ${sub.photoBonus} photo bonus` : ''}
        </small>
      </div>
      <input className="input" placeholder="Add a cheer or note for her (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row">
        <button
          type="button"
          className="btn go grow"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await actions.approveSubmission(sub, points, note)
            sounds.chime()
          }}
        >
          ✅ Approve +{points}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await actions.rejectSubmission(sub, note || 'Almost! Let’s finish it together.')
          }}
        >
          🔁 Send back
        </button>
      </div>
    </motion.section>
  )
}

function OrderRequestCard({ order }: { order: Order }) {
  const { actions } = useStore()
  const [note, setNote] = useState('')
  const link = safeUrl(order.link)
  return (
    <section className="card review-card">
      <div className="review-head">
        <span className="row-emoji">{order.emoji}</span>
        <div className="grow">
          <strong>{order.title}</strong>
          <small className="muted">
            ⭐ {order.points} {order.price ? `· about ${money(order.price)}` : ''} · {timeAgo(order.createdAt)}
          </small>
          {link && (
            <a href={link} target="_blank" rel="noreferrer">
              Open link ↗
            </a>
          )}
        </div>
      </div>
      <input className="input" placeholder="Note for her (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row">
        <button type="button" className="btn go grow" onClick={() => actions.updateOrder(order, 'approved', note)}>
          💰 Add to payday list
        </button>
        <button type="button" className="btn ghost" onClick={() => actions.updateOrder(order, 'declined', note)}>
          ↩️ Decline & refund
        </button>
      </div>
    </section>
  )
}

function WishCard({ wish }: { wish: Wish }) {
  const { actions } = useStore()
  const [title, setTitle] = useState(wish.title)
  const [points, setPoints] = useState(suggestPrizePoints(wish.price ?? 5))
  const [emoji, setEmoji] = useState('🎁')
  const [note, setNote] = useState('')
  const link = safeUrl(wish.link)
  return (
    <section className="card review-card">
      <div className="review-head">
        <span className="row-emoji">💭</span>
        <div className="grow">
          <strong>{wish.title}</strong>
          <small className="muted">
            {wish.price ? `${money(wish.price)} · ` : ''}
            {timeAgo(wish.createdAt)}
          </small>
          {link && (
            <a href={link} target="_blank" rel="noreferrer">
              Open link ↗
            </a>
          )}
        </div>
      </div>
      {wish.photo && <Photo src={wish.photo} alt={wish.title} className="review-photo" />}
      {wish.note && <p className="quote">“{wish.note}”</p>}
      <label className="field">
        Shop name
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="points-edit">
        <label>
          Price in stars
          <input type="number" className="input small" value={points} onChange={(e) => setPoints(Math.max(1, parseInt(e.target.value) || 1))} />
        </label>
        <small className="muted">Suggested: {suggestPrizePoints(wish.price ?? 5)} ({STARS_PER_DOLLAR} stars per dollar)</small>
      </div>
      <EmojiRow value={emoji} onChange={setEmoji} />
      <input className="input" placeholder="Note for her (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row">
        <button type="button" className="btn go grow" onClick={() => actions.approveWish(wish, points, emoji, title.trim() || wish.title)}>
          🛍️ Add to her shop
        </button>
        <button type="button" className="btn ghost" onClick={() => actions.declineWish(wish, note)}>
          Not this time
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

function Schedule() {
  const { data, actions } = useStore()
  const [day, setDay] = useState(new Date().getDay())
  const chores = data.chores.filter((c) => c.type === 'chore')
  const on = chores.filter((c) => c.days.includes(day))
  const off = chores.filter((c) => !c.days.includes(day))
  const toggle = (c: Chore) => {
    const days = c.days.includes(day) ? c.days.filter((d) => d !== day) : [...c.days, day].sort()
    void actions.put({ ...c, days })
  }
  const dayTotal = on.reduce((s, c) => s + c.points, 0)
  const weekTotal = chores.reduce((s, c) => s + c.points * c.days.length, 0)
  return (
    <div className="stack">
      <h2 className="section-title">📅 Weekly schedule</h2>
      <p className="muted">Pick a day, then tap chores to add or remove them. {data.settings.kidName}'s iPad updates right away.</p>
      <div className="day-chips">
        {DAY_NAMES.map((d, i) => (
          <button type="button" key={d} className={i === day ? 'day-chip on' : 'day-chip'} onClick={() => setDay(i)}>
            {d}
            <small>{chores.filter((c) => c.days.includes(i)).length}</small>
          </button>
        ))}
      </div>
      <section className="card">
        <h3>
          On {DAY_FULL[day]} ({on.length}) <small className="muted">· up to ⭐ {dayTotal}</small>
        </h3>
        {!on.length && <p className="muted">Nothing yet. Tap chores below to add them.</p>}
        {on.map((c) => (
          <button type="button" key={c.id} className="sched-row on" onClick={() => toggle(c)}>
            <span>{c.emoji}</span>
            <span className="grow">{c.title}</span>
            <span className="muted">⭐ {c.points}</span>
            <span className="check">✓</span>
          </button>
        ))}
      </section>
      <section className="card">
        <h3>Add from the chore list</h3>
        {groupByCategory(off).map(([cat, list]) => (
          <div key={cat}>
            <div className="cat-label">{CATEGORY_LABELS[cat]}</div>
            {list.map((c) => (
              <button type="button" key={c.id} className="sched-row" onClick={() => toggle(c)}>
                <span>{c.emoji}</span>
                <span className="grow">{c.title}</span>
                <span className="muted">⭐ {c.points}</span>
                <span className="check">+</span>
              </button>
            ))}
          </div>
        ))}
      </section>
      <p className="muted center">The full week offers up to ⭐ {weekTotal} from chores, plus bonus quests.</p>
    </div>
  )
}

function groupByCategory(list: Chore[]): Array<[ChoreCategory, Chore[]]> {
  const map = new Map<ChoreCategory, Chore[]>()
  for (const c of list) map.set(c.category, [...(map.get(c.category) ?? []), c])
  return [...map.entries()]
}

// ---------------------------------------------------------------------------

function Catalog() {
  const { data, actions } = useStore()
  const [view, setView] = useState<'chore' | 'bonus'>('chore')
  const [editing, setEditing] = useState<Chore | null>(null)
  const list = data.chores.filter((c) => c.type === view)
  const blank = (): Chore => ({
    id: uid(),
    kind: 'chore',
    type: view,
    title: '',
    emoji: view === 'bonus' ? '🚀' : '⭐',
    category: view === 'bonus' ? 'learning' : 'cleaning',
    minutes: 10,
    effort: 2,
    points: suggestPoints(10, 2),
    photoBonus: suggestPhotoBonus(suggestPoints(10, 2)),
    days: [],
    perWeek: view === 'bonus' ? 3 : undefined,
    active: view === 'bonus',
    createdAt: nowIso(),
  })
  return (
    <div className="stack">
      <div className="seg">
        <button type="button" className={view === 'chore' ? 'on' : ''} onClick={() => setView('chore')}>
          📋 Chores
        </button>
        <button type="button" className={view === 'bonus' ? 'on' : ''} onClick={() => setView('bonus')}>
          🚀 Bonus quests
        </button>
      </div>
      <button type="button" className="btn go" onClick={() => setEditing(blank())}>
        ＋ New {view === 'bonus' ? 'bonus quest' : 'chore'}
      </button>
      {view === 'bonus' && <p className="muted">Switch quests on to show them to {data.settings.kidName} this week.</p>}
      {groupByCategory(list).map(([cat, items]) => (
        <section className="card" key={cat}>
          <h3>{CATEGORY_LABELS[cat]}</h3>
          {items.map((c) => (
            <div key={c.id} className="cat-row">
              <span className="row-emoji small">{c.emoji}</span>
              <button type="button" className="grow linkish" onClick={() => setEditing(c)}>
                <strong>{c.title}</strong>
                <small className="muted">
                  ⭐ {c.points} +{c.photoBonus}📸 · {c.minutes} min · {EFFORT_LABELS[c.effort]}
                  {c.type === 'chore' && c.days.length ? ` · ${c.days.length === 7 ? 'every day' : c.days.map((d) => DAY_NAMES[d]).join(' ')}` : ''}
                  {c.type === 'bonus' ? ` · ${c.perWeek}×/week` : ''}
                </small>
              </button>
              {c.type === 'bonus' && <Toggle on={c.active} onChange={(active) => void actions.put({ ...c, active })} />}
            </div>
          ))}
        </section>
      ))}
      <ChoreEditor chore={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" className={on ? 'toggle on' : 'toggle'} onClick={() => onChange(!on)} aria-pressed={on}>
      <motion.span layout className="knob" />
    </button>
  )
}

function EmojiRow({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <div className="emoji-row">
      {EMOJI_CHOICES.map((e) => (
        <button type="button" key={e} className={e === value ? 'on' : ''} onClick={() => onChange(e)}>
          {e}
        </button>
      ))}
    </div>
  )
}

function ChoreEditor({ chore, onClose }: { chore: Chore | null; onClose: () => void }) {
  const { data, actions } = useStore()
  const [c, setC] = useState<Chore | null>(chore)
  useEffect(() => setC(chore), [chore])
  const exists = !!chore && data.chores.some((x) => x.id === chore.id)
  if (!c) return <Modal open={false} onClose={onClose}>{null}</Modal>
  const suggestion = suggestPoints(c.minutes, c.effort)
  const set = (patch: Partial<Chore>) => setC({ ...c, ...patch })
  return (
    <Modal open={!!chore} onClose={onClose}>
      <h2>{exists ? 'Edit' : 'New'} {c.type === 'bonus' ? 'bonus quest' : 'chore'}</h2>
      <label className="field">
        Name
        <input className="input" value={c.title} placeholder="e.g. Feed Lilo dinner" onChange={(e) => set({ title: e.target.value })} />
      </label>
      <EmojiRow value={c.emoji} onChange={(emoji) => set({ emoji })} />
      <label className="field">
        Category
        <select className="input" value={c.category} onChange={(e) => set({ category: e.target.value as ChoreCategory })}>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Tip for {data.settings.kidName} (optional)
        <input className="input" value={c.description ?? ''} onChange={(e) => set({ description: e.target.value || undefined })} />
      </label>
      <label className="field">
        How long does it take? <strong>{c.minutes} min</strong>
        <input type="range" min={1} max={90} value={c.minutes} onChange={(e) => set({ minutes: parseInt(e.target.value) })} />
      </label>
      <div className="field">
        How much effort?
        <div className="seg">
          {([1, 2, 3] as Effort[]).map((e) => (
            <button type="button" key={e} className={c.effort === e ? 'on' : ''} onClick={() => set({ effort: e })}>
              {EFFORT_LABELS[e]}
            </button>
          ))}
        </div>
      </div>
      <div className="suggest">
        💡 Suggested: <strong>⭐ {suggestion}</strong> stars, +{suggestPhotoBonus(suggestion)} with a photo
        <button type="button" className="btn tiny" onClick={() => set({ points: suggestion, photoBonus: suggestPhotoBonus(suggestion) })}>
          Use it
        </button>
      </div>
      <div className="row">
        <label className="field grow">
          Stars
          <input type="number" className="input" value={c.points} min={0} onChange={(e) => set({ points: Math.max(0, parseInt(e.target.value) || 0) })} />
        </label>
        <label className="field grow">
          Photo bonus
          <input type="number" className="input" value={c.photoBonus} min={0} onChange={(e) => set({ photoBonus: Math.max(0, parseInt(e.target.value) || 0) })} />
        </label>
      </div>
      {c.type === 'chore' ? (
        <div className="field">
          Days on her list
          <div className="day-chips">
            {DAY_NAMES.map((d, i) => (
              <button
                type="button"
                key={d}
                className={c.days.includes(i) ? 'day-chip on' : 'day-chip'}
                onClick={() => set({ days: c.days.includes(i) ? c.days.filter((x) => x !== i) : [...c.days, i].sort() })}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="row">
          <label className="field grow">
            Times per week
            <input type="number" className="input" min={1} max={14} value={c.perWeek ?? 1} onChange={(e) => set({ perWeek: Math.max(1, parseInt(e.target.value) || 1) })} />
          </label>
          <div className="field">
            Show this week
            <Toggle on={c.active} onChange={(active) => set({ active })} />
          </div>
        </div>
      )}
      <div className="row">
        <button
          type="button"
          className="btn go grow"
          disabled={!c.title.trim()}
          onClick={async () => {
            await actions.put({ ...c, title: c.title.trim() })
            onClose()
          }}
        >
          Save
        </button>
        {exists && (
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              if (!confirm(`Delete “${c.title}”?`)) return
              await actions.remove(c.id)
              onClose()
            }}
          >
            Delete
          </button>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------

function Prizes() {
  const { data, actions } = useStore()
  const [view, setView] = useState<'payday' | 'shop'>('payday')
  const [editing, setEditing] = useState<Prize | null>(null)
  const toBuy = data.orders.filter((o) => o.status === 'approved' || o.status === 'requested')
  const bought = data.orders.filter((o) => o.status === 'purchased')
  const history = data.orders.filter((o) => o.status === 'delivered' || o.status === 'declined').slice(0, 15)
  const total = toBuy.reduce((s, o) => s + (o.price ?? 0), 0)
  const blank = (): Prize => ({ id: uid(), kind: 'prize', title: '', emoji: '🎁', points: 50, active: true, createdAt: nowIso() })
  return (
    <div className="stack">
      <div className="seg">
        <button type="button" className={view === 'payday' ? 'on' : ''} onClick={() => setView('payday')}>
          💰 Payday list
        </button>
        <button type="button" className={view === 'shop' ? 'on' : ''} onClick={() => setView('shop')}>
          🛍️ Her prize shop
        </button>
      </div>
      {view === 'payday' ? (
        <>
          <section className="card">
            <h3>
              To buy next paycheck {total > 0 && <small className="muted">· about {money(total)}</small>}
            </h3>
            {!toBuy.length && <p className="muted">Nothing to buy yet. When {data.settings.kidName} spends her stars, prizes land here.</p>}
            {toBuy.map((o) => (
              <OrderRow key={o.id} order={o} next="purchased" label="🛍️ Bought it" />
            ))}
          </section>
          {bought.length > 0 && (
            <section className="card">
              <h3>Bought, waiting to give her</h3>
              {bought.map((o) => (
                <OrderRow key={o.id} order={o} next="delivered" label="🎉 Gave it to her" />
              ))}
            </section>
          )}
          {history.length > 0 && (
            <section className="card">
              <h3>History</h3>
              {history.map((o) => (
                <div key={o.id} className="history-row">
                  <span>{o.emoji}</span>
                  <span className="grow">{o.title}</span>
                  <small className="muted">{o.status === 'delivered' ? 'given' : 'declined'}</small>
                </div>
              ))}
            </section>
          )}
        </>
      ) : (
        <>
          <button type="button" className="btn go" onClick={() => setEditing(blank())}>
            ＋ New prize
          </button>
          <section className="card">
            {data.prizes.map((p) => (
              <div key={p.id} className="cat-row">
                <span className="row-emoji small">{p.emoji}</span>
                <button type="button" className="grow linkish" onClick={() => setEditing(p)}>
                  <strong>{p.title}</strong>
                  <small className="muted">
                    ⭐ {p.points}
                    {p.price ? ` · ${money(p.price)}` : ''}
                  </small>
                </button>
                <Toggle on={p.active} onChange={(active) => void actions.put({ ...p, active })} />
              </div>
            ))}
          </section>
        </>
      )}
      <PrizeEditor prize={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function OrderRow({ order, next, label }: { order: Order; next: Order['status']; label: string }) {
  const { actions } = useStore()
  const link = safeUrl(order.link)
  return (
    <div className="cat-row">
      <span className="row-emoji small">{order.emoji}</span>
      <div className="grow">
        <strong>{order.title}</strong>
        <small className="muted">
          ⭐ {order.points}
          {order.price ? ` · ${money(order.price)}` : ''} · {timeAgo(order.createdAt)}
          {order.status === 'requested' ? ' · new' : ''}
        </small>
        {link && (
          <a href={link} target="_blank" rel="noreferrer">
            Open link ↗
          </a>
        )}
      </div>
      <button type="button" className="btn tiny go" onClick={() => actions.updateOrder(order, next)}>
        {label}
      </button>
    </div>
  )
}

function PrizeEditor({ prize, onClose }: { prize: Prize | null; onClose: () => void }) {
  const { data, actions } = useStore()
  const [p, setP] = useState<Prize | null>(prize)
  useEffect(() => setP(prize), [prize])
  if (!p) return <Modal open={false} onClose={onClose}>{null}</Modal>
  const exists = data.prizes.some((x) => x.id === p.id)
  const set = (patch: Partial<Prize>) => setP({ ...p, ...patch })
  return (
    <Modal open={!!prize} onClose={onClose}>
      <h2>{exists ? 'Edit prize' : 'New prize'}</h2>
      <label className="field">
        Name
        <input className="input" value={p.title} placeholder="e.g. Trip to the aquarium" onChange={(e) => set({ title: e.target.value })} />
      </label>
      <EmojiRow value={p.emoji} onChange={(emoji) => set({ emoji })} />
      <div className="row">
        <label className="field grow">
          Cost to you ($, optional)
          <input type="number" className="input" value={p.price ?? ''} min={0} step="0.01" onChange={(e) => set({ price: parseFloat(e.target.value) || undefined })} />
        </label>
        <label className="field grow">
          Stars
          <input type="number" className="input" value={p.points} min={1} onChange={(e) => set({ points: Math.max(1, parseInt(e.target.value) || 1) })} />
        </label>
      </div>
      {!!p.price && (
        <div className="suggest">
          💡 Suggested: <strong>⭐ {suggestPrizePoints(p.price)}</strong>
          <button type="button" className="btn tiny" onClick={() => set({ points: suggestPrizePoints(p.price ?? 0) })}>
            Use it
          </button>
        </div>
      )}
      <label className="field">
        Link (optional)
        <input className="input" value={p.link ?? ''} inputMode="url" onChange={(e) => set({ link: e.target.value || undefined })} />
      </label>
      <label className="field">
        Description (optional)
        <input className="input" value={p.description ?? ''} onChange={(e) => set({ description: e.target.value || undefined })} />
      </label>
      <div className="row">
        <button
          type="button"
          className="btn go grow"
          disabled={!p.title.trim()}
          onClick={async () => {
            await actions.put({ ...p, title: p.title.trim(), link: safeUrl(p.link) })
            onClose()
          }}
        >
          Save
        </button>
        {exists && (
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              if (!confirm(`Delete “${p.title}”?`)) return
              await actions.remove(p.id)
              onClose()
            }}
          >
            Delete
          </button>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------

function Family() {
  const { data, actions, backend } = useStore()
  const s = data.settings
  const [note, setNote] = useState('')
  const [from, setFrom] = useState('Mom & Dad')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  const [codes, setCodes] = useState<{ parentCode: string; kidCode: string } | null>(null)
  const [devOpen, setDevOpen] = useState(false)
  const [notifyState, setNotifyState] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  useEffect(() => {
    backend.familyCodes().then(setCodes).catch(() => setCodes(null))
  }, [backend])
  const weekApproved = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000
    return data.ledger.filter((e) => e.amount > 0 && new Date(e.createdAt).getTime() > weekAgo).reduce((a, e) => a + e.amount, 0)
  }, [data.ledger])

  return (
    <div className="stack">
      <section className="card">
        <h3>💌 Love notes for {s.kidName}</h3>
        <p className="muted">Your newest note shows on her home screen, alongside Lilo's daily wise words.</p>
        <textarea className="input" rows={3} placeholder={`We are so proud of you, ${s.kidName}…`} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="row">
          <input className="input grow" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
          <button
            type="button"
            className="btn go"
            disabled={!note.trim()}
            onClick={async () => {
              await actions.addNote(note.trim(), from.trim() || 'Mom & Dad')
              setNote('')
            }}
          >
            Send 💖
          </button>
        </div>
        {data.notes.slice(0, 5).map((n) => (
          <div key={n.id} className="history-row">
            <span>💌</span>
            <span className="grow">
              {n.text} <small className="muted">· {n.from}</small>
            </span>
            <button type="button" className="btn tiny ghost" onClick={() => actions.remove(n.id)}>
              ✕
            </button>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>⭐ Give or take stars</h3>
        <p className="muted">
          Balance ⭐ {data.balance} · earned ⭐ {weekApproved} in the last 7 days
        </p>
        <div className="row">
          <input className="input small" inputMode="numeric" placeholder="+10 or -5" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="input grow" placeholder="Why? (e.g. Great report card!)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn"
          disabled={!parseInt(amount)}
          onClick={async () => {
            await actions.adjustPoints(parseInt(amount), reason)
            setAmount('')
            setReason('')
          }}
        >
          Save
        </button>
      </section>

      <section className="card">
        <h3>📱 Connect devices</h3>
        {codes ? (
          <>
            <p className="muted">Open the app on another device and enter a code. Keep the parent code private.</p>
            <div className="code-box">
              <div>
                <small>{s.kidName}'s iPad</small>
                <strong>{codes.kidCode}</strong>
              </div>
              <div>
                <small>Parent phones</small>
                <strong>{codes.parentCode}</strong>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Codes are only shown on parent devices.</p>
        )}
        {backend.mode === 'demo' && <p className="warn">Demo mode: data stays on this device. Connect Supabase to sync phones and the iPad (see README).</p>}
        {notifyState === 'default' && (
          <button
            type="button"
            className="btn"
            onClick={async () => setNotifyState(await Notification.requestPermission())}
          >
            🔔 Allow notifications on this phone
          </button>
        )}
      </section>

      <section className="card">
        <h3>⚙️ Settings</h3>
        <label className="field">
          Kid's name
          <input className="input" value={s.kidName} onChange={(e) => actions.updateSettings({ kidName: e.target.value })} />
        </label>
        <label className="field">
          Name for the points
          <input className="input" value={s.currency} onChange={(e) => actions.updateSettings({ currency: e.target.value })} />
        </label>
        <div className="field">
          Parent PIN (opens the parent area from {s.kidName}'s iPad) {s.parentPinHash ? '· set ✓' : '· not set'}
          <div className="row">
            <input
              className="input grow"
              inputMode="numeric"
              type="password"
              maxLength={8}
              placeholder="4 to 8 digits"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''))
                setPinSaved(false)
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={pin.length < 4}
              onClick={async () => {
                await actions.updateSettings({ parentPinHash: await hashPin(pin) })
                setPin('')
                setPinSaved(true)
              }}
            >
              {pinSaved ? 'Saved ✓' : 'Save PIN'}
            </button>
          </div>
        </div>
        <div className="field row">
          <span className="grow">Sounds</span>
          <Toggle on={s.sounds} onChange={(sounds) => actions.updateSettings({ sounds })} />
        </div>
      </section>

      <section className="card">
        <h3>📜 Star history</h3>
        {data.ledger.slice(0, 25).map((e) => (
          <div key={e.id} className="history-row">
            <span>{e.emoji}</span>
            <span className="grow">
              {e.reason} <small className="muted">· {timeAgo(e.createdAt)}</small>
            </span>
            <span className={e.amount >= 0 ? 'plus' : 'minus'}>
              {e.amount >= 0 ? '+' : ''}
              {e.amount}
            </span>
          </div>
        ))}
      </section>

      {devOpen ? (
        <DevMode />
      ) : (
        <button type="button" className="btn ghost" onClick={() => setDevOpen(true)}>
          🛠️ Open dev mode
        </button>
      )}

      <button
        type="button"
        className="btn ghost"
        onClick={async () => {
          if (!confirm('Disconnect this device from the family? You can rejoin with a code.')) return
          await backend.leaveFamily()
          location.reload()
        }}
      >
        Disconnect this device
      </button>
    </div>
  )
}
