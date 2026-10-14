import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Backend, Change, Membership } from './backend'
import { balance, byNewest, dayKey, nowIso, ofKind, pointsFor, uid } from './logic'
import { defaultSettings } from './seed'
import type { ChatMessage, Chore, Item, LedgerEntry, Order, OrderStatus, Prize, Settings, Submission, Wish } from './types'

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
  balance: number
}

function derive(items: Record<string, Item>): FamilyData {
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
    balance: balance(ledger),
  }
}

function makeActions(backend: Backend, get: () => FamilyData, apply: (c: Change) => void) {
  const put = async (item: Item) => {
    apply({ type: 'put', item })
    await backend.put(item)
  }
  const remove = async (id: string) => {
    apply({ type: 'remove', id })
    await backend.remove(id)
  }
  const ledger = (amount: number, reason: string, emoji: string, refId?: string): LedgerEntry => ({
    id: uid(),
    kind: 'ledger',
    amount,
    reason,
    emoji,
    refId,
    createdAt: nowIso(),
  })

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

    async approveSubmission(sub: Submission, points: number, parentNote?: string) {
      await put({ ...sub, status: 'approved', pointsAwarded: points, parentNote: parentNote || undefined, reviewedAt: nowIso() })
      const label = sub.type === 'homework' ? `School star: ${sub.title}` : sub.title
      await put(ledger(points, label, sub.emoji, sub.id))
    },

    async rejectSubmission(sub: Submission, parentNote?: string) {
      await put({ ...sub, status: 'rejected', parentNote: parentNote || undefined, reviewedAt: nowIso() })
    },

    async buyPrize(prize: Prize) {
      if (get().balance < prize.points) throw new Error('Not enough stars yet')
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
      await put(order)
      await put(ledger(-prize.points, `Bought: ${prize.title}`, prize.emoji, order.id))
      const s = get().settings
      if (s.goalPrizeId === prize.id) await put({ ...s, goalPrizeId: undefined })
      return order
    },

    async updateOrder(order: Order, status: OrderStatus, parentNote?: string) {
      await put({ ...order, status, parentNote: parentNote ?? order.parentNote, updatedAt: nowIso() })
      if (status === 'declined' && order.status !== 'declined') {
        await put(ledger(order.points, `Refund: ${order.title}`, '↩️', `refund:${order.id}`))
      }
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

    async approveWish(wish: Wish, points: number, emoji: string, title: string) {
      const prize: Prize = {
        id: uid(),
        kind: 'prize',
        title,
        emoji,
        link: wish.link,
        photo: wish.photo,
        price: wish.price,
        points,
        active: true,
        createdAt: nowIso(),
      }
      await put(prize)
      await put({ ...wish, status: 'added' })
    },

    async declineWish(wish: Wish, parentNote?: string) {
      await put({ ...wish, status: 'declined', parentNote: parentNote || undefined })
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

export function StoreProvider({ backend, membership, children }: { backend: Backend; membership: Membership; children: ReactNode }) {
  const itemsRef = useRef<Record<string, Item>>({})
  const [version, setVersion] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [events, setEvents] = useState<FamilyEvent[]>([])
  const dataRef = useRef<FamilyData>(derive({}))
  // Ids this device just wrote, so their realtime echoes don't show up as news.
  const localWrites = useRef(new Map<string, number>())

  const data = useMemo(() => {
    dataRef.current = derive(itemsRef.current)
    return dataRef.current
  }, [version])

  const actions = useMemo(() => {
    const apply = (c: Change) => {
      localWrites.current.set(c.type === 'put' ? c.item.id : c.id, Date.now())
      if (c.type === 'put') itemsRef.current = { ...itemsRef.current, [c.item.id]: c.item }
      else {
        const next = { ...itemsRef.current }
        delete next[c.id]
        itemsRef.current = next
      }
      dataRef.current = derive(itemsRef.current)
      setVersion((v) => v + 1)
    }
    return makeActions(backend, () => dataRef.current, apply)
  }, [backend])

  useEffect(() => {
    let alive = true
    backend
      .load()
      .then((items) => {
        if (!alive) return
        itemsRef.current = Object.fromEntries(items.map((i) => [i.id, i]))
        setVersion((v) => v + 1)
        setReady(true)
      })
      .catch((e: Error) => setError(e.message))

    const unsubscribe = backend.subscribe((c) => {
      const previous = c.type === 'put' ? itemsRef.current[c.item.id] : undefined
      if (c.type === 'put') {
        itemsRef.current = { ...itemsRef.current, [c.item.id]: c.item }
        const wroteAt = localWrites.current.get(c.item.id)
        const isEcho = wroteAt !== undefined && Date.now() - wroteAt < 15_000
        if (!isEcho) setEvents((ev) => [...ev.slice(-9), { id: uid(), item: c.item, previous }])
      } else {
        const next = { ...itemsRef.current }
        delete next[c.id]
        itemsRef.current = next
      }
      setVersion((v) => v + 1)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [backend])

  const value: StoreValue = {
    backend,
    membership,
    data,
    actions,
    events,
    dismissEvent: (id) => setEvents((ev) => ev.filter((e) => e.id !== id)),
    ready,
    error,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore outside StoreProvider')
  return v
}

export { pointsFor }
