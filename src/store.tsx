import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Backend, Change, Membership } from './backend'
import { balance, byNewest, dayKey, nowIso, ofKind, pickSpin, pointsFor, spinForDay, spinRef, stableKey, uid } from './logic'
import { defaultSettings } from './seed'
import type { ChatMessage, Chore, Item, LedgerEntry, Mood, MoodLevel, Order, OrderStatus, Prize, Settings, Submission, Wish } from './types'

/** Something that just happened on another device, for toasts and celebrations. */
export interface FamilyEvent {
  id: string
  item: Item
  previous?: Item
}

export interface FamilyData {
  settings: Settings
  chores: Chore[]
  submissions: Submission[]
  prizes: Prize[]
  orders: Order[]
  wishes: Wish[]
  ledger: LedgerEntry[]
  notes: Extract<Item, { kind: 'note' }>[]
  messages: ChatMessage[]
  /** Feelings check-ins, newest day first. */
  moods: Mood[]
  balance: number
}

export function derive(items: Record<string, Item>): FamilyData {
  const all = Object.values(items)
  const ledger = ofKind(all, 'ledger').sort(byNewest)
  return {
    settings: (items.settings as Settings | undefined) ?? defaultSettings(),
    chores: ofKind(all, 'chore').sort((a, b) => a.title.localeCompare(b.title)),
    submissions: ofKind(all, 'submission').sort(byNewest),
    prizes: ofKind(all, 'prize').sort((a, b) => a.points - b.points),
    orders: ofKind(all, 'order').sort(byNewest),
    wishes: ofKind(all, 'wish').sort(byNewest),
    ledger,
    notes: ofKind(all, 'note').sort(byNewest),
    messages: ofKind(all, 'message').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    moods: ofKind(all, 'mood').sort((a, b) => b.date.localeCompare(a.date)),
    balance: balance(ledger),
  }
}

/** What the actions need from the store: the latest data, and a way to change it right away. */
interface LocalStore {
  get: () => FamilyData
  /** Applies a change on this device straight away and returns the item it replaced. */
  apply: (c: Change) => Item | undefined
  /** Puts an item back the way it was before a write that failed. */
  restore: (id: string, previous: Item | undefined) => void
}

/**
 * `scope` (the family id) keeps once-a-day ids like `spin-2026-10-14` unique in the shared database,
 * where every family's items live in one table.
 */
export function makeActions(backend: Backend, store: LocalStore, scope = '') {
  const { get } = store
  const daily = (prefix: string, day: string) => (scope ? `${prefix}-${day}-${scope}` : `${prefix}-${day}`)
  // Every write shows up on this device immediately (so a second tap already sees the new
  // balance), then goes to the backend. If the backend refuses it, the change is undone.
  const put = async (item: Item) => {
    const previous = store.apply({ type: 'put', item })
    try {
      await backend.put(item)
    } catch (e) {
      store.restore(item.id, previous)
      throw e
    }
  }
  const remove = async (id: string) => {
    const previous = store.apply({ type: 'remove', id })
    try {
      await backend.remove(id)
    } catch (e) {
      store.restore(id, previous)
      throw e
    }
  }
  const ledger = (amount: number, reason: string, emoji: string, refId?: string, id: string = uid()): LedgerEntry => ({
    id,
    kind: 'ledger',
    amount,
    reason,
    emoji,
    refId,
    createdAt: nowIso(),
  })
  const latest = <T extends { id: string }>(list: T[], item: T): T | undefined => list.find((x) => x.id === item.id)

  return {
    put,
    remove,
    uploadPhoto: (blob: Blob) => backend.uploadPhoto(blob),

    async submitChore(chore: Chore, photo?: Blob, note?: string) {
      const sub: Submission = {
        id: uid(),
        kind: 'submission',
        type: chore.type,
        choreId: chore.id,
        title: chore.title,
        emoji: chore.emoji,
        date: dayKey(),
        photo: photo ? await backend.uploadPhoto(photo) : undefined,
        note: note || undefined,
        status: 'pending',
        basePoints: chore.points,
        photoBonus: chore.photoBonus,
        createdAt: nowIso(),
      }
      await put(sub)
      return sub
    },

    async submitHomework(title: string, photo: Blob, note?: string) {
      const sub: Submission = {
        id: uid(),
        kind: 'submission',
        type: 'homework',
        title: title || 'School work',
        emoji: '🧠',
        date: dayKey(),
        photo: await backend.uploadPhoto(photo),
        note: note || undefined,
        status: 'pending',
        basePoints: 15,
        photoBonus: 0,
        createdAt: nowIso(),
      }
      await put(sub)
      return sub
    },

    /** Approves once: a double tap, "Approve all" or a second parent can't pay out twice. */
    async approveSubmission(sub: Submission, points: number, parentNote?: string) {
      const current = latest(get().submissions, sub)
      if (!current || current.status !== 'pending') return
      const label = current.type === 'homework' ? `School star: ${current.title}` : current.title
      await Promise.all([
        put({ ...current, status: 'approved', pointsAwarded: points, parentNote: parentNote || undefined, reviewedAt: nowIso() }),
        put(ledger(points, label, current.emoji, current.id, `award-${current.id}`)),
      ])
    },

    async rejectSubmission(sub: Submission, parentNote?: string) {
      const current = latest(get().submissions, sub)
      if (!current || current.status !== 'pending') return
      await put({ ...current, status: 'rejected', parentNote: parentNote || undefined, reviewedAt: nowIso() })
    },

    async buyPrize(prize: Prize) {
      const d = get()
      if (d.balance < prize.points) throw new Error('Not enough stars yet')
      const order: Order = {
        id: uid(),
        kind: 'order',
        prizeId: prize.id,
        title: prize.title,
        emoji: prize.emoji,
        link: prize.link,
        price: prize.price,
        points: prize.points,
        status: 'requested',
        createdAt: nowIso(),
      }
      // The order and the payment land together, before anything waits on the network.
      const writes = [put(order), put(ledger(-prize.points, `Bought: ${prize.title}`, prize.emoji, order.id, `buy-${order.id}`))]
      if (d.settings.goalPrizeId === prize.id) writes.push(put({ ...d.settings, goalPrizeId: undefined }))
      await Promise.all(writes)
      return order
    },

    async updateOrder(order: Order, status: OrderStatus, parentNote?: string) {
      const d = get()
      const current = latest(d.orders, order)
      if (!current || current.status === status || current.status === 'declined') return
      const writes = [put({ ...current, status, parentNote: parentNote || current.parentNote, updatedAt: nowIso() })]
      const refundId = `refund:${current.id}`
      if (status === 'declined' && !d.ledger.some((e) => e.refId === refundId)) {
        writes.push(put(ledger(current.points, `Refund: ${current.title}`, '↩️', refundId, `refund-${current.id}`)))
      }
      await Promise.all(writes)
    },

    async submitWish(w: { title: string; link?: string; price?: number; note?: string; photo?: Blob }) {
      const wish: Wish = {
        id: uid(),
        kind: 'wish',
        title: w.title,
        link: w.link || undefined,
        price: w.price || undefined,
        note: w.note || undefined,
        photo: w.photo ? await backend.uploadPhoto(w.photo) : undefined,
        status: 'pending',
        createdAt: nowIso(),
      }
      await put(wish)
      return wish
    },

    async approveWish(wish: Wish, points: number, emoji: string, title: string, parentNote?: string) {
      const current = latest(get().wishes, wish)
      if (!current || current.status !== 'pending') return
      const prize: Prize = {
        id: uid(),
        kind: 'prize',
        title,
        emoji,
        link: current.link,
        photo: current.photo,
        price: current.price,
        points,
        active: true,
        createdAt: nowIso(),
      }
      await Promise.all([put(prize), put({ ...current, status: 'added', parentNote: parentNote || undefined })])
    },

    async declineWish(wish: Wish, parentNote?: string) {
      const current = latest(get().wishes, wish)
      if (!current || current.status !== 'pending') return
      await put({ ...current, status: 'declined', parentNote: parentNote || undefined })
    },

    async adjustPoints(amount: number, reason: string) {
      await put(ledger(amount, reason || (amount > 0 ? 'Gift from family' : 'Adjustment'), amount > 0 ? '🎁' : '✏️'))
    },

    async updateSettings(patch: Partial<Settings>) {
      await put({ ...get().settings, ...patch })
    },

    async sendMessage(from: ChatMessage['from'], author: string, text: string, sticker?: string, photo?: Blob) {
      const ref = photo ? await backend.uploadPhoto(photo) : undefined
      await put({ id: uid(), kind: 'message', from, author, text, sticker, photo: ref, createdAt: nowIso() })
    },

    async addNote(text: string, from: string) {
      await put({ id: uid(), kind: 'note', text, from, createdAt: nowIso() })
    },

    /**
     * Today's Lucky Spin: picks 1-10 bonus stars and pays them straight away, before the wheel
     * even starts turning. Once a day: the ledger id is fixed per day, so it can't pay twice.
     */
    async spinWheel(day: string = dayKey(), r: number = Math.random()): Promise<{ stars: number; already: boolean }> {
      const done = spinForDay(get().ledger, day)
      if (done) return { stars: done.amount, already: true }
      const stars = pickSpin(r)
      await put(ledger(stars, 'Lucky Spin', '🎡', spinRef(day), daily('spin', day)))
      return { stars, already: false }
    },

    /** Dev mode: lets Maya spin again today (takes back today's spin stars). */
    async resetSpin(day: string = dayKey()) {
      const entries = get().ledger.filter((e) => e.refId === spinRef(day))
      await Promise.all(entries.map((e) => remove(e.id)))
    },

    /** Maya's feelings check-in. One per day; picking again changes today's answer. */
    async checkInMood(mood: MoodLevel, note?: string, day: string = dayKey()) {
      const current = get().moods.find((m) => m.date === day)
      const item: Mood = {
        id: current?.id ?? daily('mood', day),
        kind: 'mood',
        date: day,
        mood,
        note: note?.trim() || undefined,
        createdAt: current?.createdAt ?? nowIso(),
        updatedAt: current ? nowIso() : undefined,
      }
      await put(item)
      return item
    },
  }
}

export type Actions = ReturnType<typeof makeActions>

interface StoreValue {
  backend: Backend
  membership: Membership
  data: FamilyData
  actions: Actions
  events: FamilyEvent[]
  dismissEvent: (id: string) => void
  ready: boolean
  error?: string
}

const StoreContext = createContext<StoreValue | null>(null)

/** How long this device remembers its own writes, to recognise their realtime echoes. */
const ECHO_WINDOW_MS = 60_000
/** Reload everything when the app comes back after being hidden this long (realtime misses changes while asleep). */
const RESYNC_AFTER_MS = 20_000

export function StoreProvider({ backend, membership, children }: { backend: Backend; membership: Membership; children: ReactNode }) {
  const itemsRef = useRef<Record<string, Item>>({})
  const [version, setVersion] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const cache = useRef<{ items: Record<string, Item>; data: FamilyData } | null>(null)
  // What this device just wrote (content keys, newest last), so realtime echoes of our own
  // writes don't show up as news and stale echoes don't undo a newer local change.
  const localWrites = useRef(new Map<string, { at: number; keys: string[] }>())

  /** Derived data for the current items, computed at most once per change. */
  const getData = useCallback(() => {
    if (!cache.current || cache.current.items !== itemsRef.current) {
      cache.current = { items: itemsRef.current, data: derive(itemsRef.current) }
    }
    return cache.current.data
  }, [])

  // `version` changes whenever itemsRef does; getData only re-derives when the items changed.
  const data = useMemo(() => getData(), [version, getData])

  const actions = useMemo(() => {
    const setItem = (id: string, item: Item | undefined) => {
      const next = { ...itemsRef.current }
      if (item) next[id] = item
      else delete next[id]
      itemsRef.current = next
      setVersion((v) => v + 1)
    }
    const apply = (c: Change) => {
      const id = c.type === 'put' ? c.item.id : c.id
      const previous = itemsRef.current[id]
      if (c.type === 'put') {
        const now = Date.now()
        const rec = localWrites.current.get(id)
        const key = stableKey(c.item)
        const keys = rec && now - rec.at < ECHO_WINDOW_MS ? [...rec.keys.slice(-4), key] : [key]
        localWrites.current.set(id, { at: now, keys })
        setItem(id, c.item)
      } else if (previous) {
        setItem(id, undefined)
      }
      return previous
    }
    const restore = (id: string, previous: Item | undefined) => {
      if (previous) apply({ type: 'put', item: previous })
      else if (itemsRef.current[id]) setItem(id, undefined)
    }
    return makeActions(backend, { get: getData, apply, restore }, membership.familyId)
  }, [backend, getData, membership.familyId])

  useEffect(() => {
    let alive = true
    let loaded = false
    let buffered: Change[] = []

    const isFresh = (id: string) => {
      const rec = localWrites.current.get(id)
      return !!rec && Date.now() - rec.at < ECHO_WINDOW_MS
    }

    /** Takes in an item from another device (or a reload). Returns a news event if it is new to us. */
    const ingest = (next: Record<string, Item>, item: Item, emit: boolean, fromReload: boolean): FamilyEvent | null | undefined => {
      const current = next[item.id]
      const key = stableKey(item)
      const rec = localWrites.current.get(item.id)
      if (rec && isFresh(item.id)) {
        if (rec.keys.includes(key)) {
          // Our own write coming back. Only the newest one matters; older ones are stale.
          if (key !== rec.keys[rec.keys.length - 1] || (current && stableKey(current) === key)) return undefined
          next[item.id] = item
          return null
        }
        // A reload can race a write that is still on its way: keep the local version.
        if (fromReload) return undefined
      }
      if (current && stableKey(current) === key) return undefined
      next[item.id] = item
      return emit ? { id: uid(), item, previous: current } : null
    }

    /** Applies remote changes in one go. `undefined` from ingest means nothing changed. */
    const applyRemote = (changes: Change[], emit: boolean) => {
      const next = { ...itemsRef.current }
      let changed = false
      const news: FamilyEvent[] = []
      for (const c of changes) {
        if (c.type === 'put') {
          const ev = ingest(next, c.item, emit, false)
          if (ev !== undefined) changed = true
          if (ev) news.push(ev)
        } else if (next[c.id]) {
          delete next[c.id]
          changed = true
        }
      }
      if (!changed) return
      itemsRef.current = next
      setVersion((v) => v + 1)
      if (news.length) setEvents((ev) => [...ev, ...news].slice(-10))
    }

    const resync = async () => {
      const items = await backend.load()
      if (!alive) return
      const next = { ...itemsRef.current }
      const seen = new Set<string>()
      let changed = false
      const news: FamilyEvent[] = []
      for (const item of items) {
        seen.add(item.id)
        const ev = ingest(next, item, true, true)
        if (ev !== undefined) changed = true
        if (ev) news.push(ev)
      }
      for (const id of Object.keys(next)) {
        if (!seen.has(id) && !isFresh(id)) {
          delete next[id]
          changed = true
        }
      }
      for (const [id, rec] of localWrites.current) if (Date.now() - rec.at >= ECHO_WINDOW_MS) localWrites.current.delete(id)
      if (!changed) return
      itemsRef.current = next
      setVersion((v) => v + 1)
      if (news.length) setEvents((ev) => [...ev, ...news].slice(-10))
    }

    // Subscribe first and hold changes until the first load lands, so nothing slips between.
    const unsubscribe = backend.subscribe((c) => {
      if (!loaded) buffered.push(c)
      else applyRemote([c], true)
    })

    backend
      .load()
      .then((items) => {
        if (!alive) return
        itemsRef.current = Object.fromEntries(items.map((i) => [i.id, i]))
        loaded = true
        applyRemote(buffered, false)
        buffered = []
        setVersion((v) => v + 1)
        setReady(true)
      })
      .catch((e: Error) => alive && setError(e.message))

    let hiddenAt = 0
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (loaded && Date.now() - hiddenAt > RESYNC_AFTER_MS) resync().catch(() => undefined)
    }
    const onOnline = () => {
      if (loaded) resync().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)

    return () => {
      alive = false
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [backend])

  const dismissEvent = useCallback((id: string) => setEvents((ev) => ev.filter((e) => e.id !== id)), [])

  const value = useMemo<StoreValue>(
    () => ({ backend, membership, data, actions, events, dismissEvent, ready, error }),
    [backend, membership, data, actions, events, dismissEvent, ready, error],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}

export { pointsFor }
