import { describe, expect, it } from 'vitest'
import { wordsForToday } from './encouragement'
import {
  balance,
  bonusUsesThisWeek,
  choresForDay,
  levelFor,
  lifetimeEarned,
  pointsFor,
  streak,
  submissionForDay,
  suggestPhotoBonus,
  suggestPoints,
  suggestPrizePoints,
  stableKey,
  weekStartKey,
} from './logic'
import { seedItems } from './seed'
import type { Backend, Change } from './backend'
import { derive, makeActions } from './store'
import type { Chore, Item, LedgerEntry, Prize, Submission } from './types'

const sub = (over: Partial<Submission>): Submission => ({
  id: Math.random().toString(),
  kind: 'submission',
  type: 'chore',
  title: 't',
  emoji: '⭐',
  date: '2026-10-14',
  status: 'pending',
  basePoints: 10,
  photoBonus: 3,
  createdAt: '2026-10-14T10:00:00Z',
  ...over,
})

const entry = (amount: number, refId?: string): LedgerEntry => ({
  id: Math.random().toString(),
  kind: 'ledger',
  amount,
  reason: 'r',
  emoji: '⭐',
  refId,
  createdAt: '2026-10-14T10:00:00Z',
})

describe('point suggestions', () => {
  it('scales with time and effort and rounds to friendly numbers', () => {
    expect(suggestPoints(3, 1)).toBe(3)
    expect(suggestPoints(10, 2)).toBe(15)
    expect(suggestPoints(30, 3)).toBe(60)
    expect(suggestPoints(0, 1)).toBe(2)
    expect(suggestPoints(20, 2) % 5).toBe(0)
  })
  it('gives at least 2 photo bonus stars', () => {
    expect(suggestPhotoBonus(3)).toBe(2)
    expect(suggestPhotoBonus(40)).toBe(10)
  })
  it('prices prizes at about 25 stars per dollar', () => {
    expect(suggestPrizePoints(1)).toBe(25)
    expect(suggestPrizePoints(2.49)).toBe(60)
    expect(suggestPrizePoints(19.99)).toBe(500)
    expect(suggestPrizePoints(0)).toBe(5)
  })
})

describe('stars', () => {
  it('adds the photo bonus only when there is a photo', () => {
    expect(pointsFor({ basePoints: 10, photoBonus: 3 })).toBe(10)
    expect(pointsFor({ basePoints: 10, photoBonus: 3, photo: 'x' })).toBe(13)
  })
  it('computes balance and lifetime earnings ignoring refunds', () => {
    const ledger = [entry(50), entry(-40, 'order1'), entry(40, 'refund:order1'), entry(10)]
    expect(balance(ledger)).toBe(60)
    expect(lifetimeEarned(ledger)).toBe(60)
  })
  it('levels up from lifetime stars', () => {
    expect(levelFor(0).level).toBe(1)
    expect(levelFor(120).title).toBe('Kitty Cadet')
    expect(levelFor(99999).next).toBe(levelFor(99999).floor)
  })
})

describe('schedule', () => {
  const chore = (days: number[], type: 'chore' | 'bonus' = 'chore') => ({ id: String(days), type, days }) as unknown as Chore
  it('lists chores scheduled on the day of the week', () => {
    const wed = new Date(2026, 9, 14) // Wednesday
    const list = choresForDay([chore([3]), chore([1]), chore([3], 'bonus')], wed)
    expect(list).toHaveLength(1)
  })
  it('ignores sent-back submissions when checking if a chore is done', () => {
    const subs = [sub({ choreId: 'a', status: 'rejected' })]
    expect(submissionForDay(subs, 'a', '2026-10-14')).toBeUndefined()
    subs.push(sub({ choreId: 'a', status: 'pending' }))
    expect(submissionForDay(subs, 'a', '2026-10-14')?.status).toBe('pending')
  })
  it('counts bonus uses within the Sunday-to-Saturday week', () => {
    const ref = new Date(2026, 9, 14)
    expect(weekStartKey(ref)).toBe('2026-10-11')
    const subs = [sub({ choreId: 'b', date: '2026-10-11' }), sub({ choreId: 'b', date: '2026-10-10' }), sub({ choreId: 'b', date: '2026-10-14', status: 'rejected' })]
    expect(bonusUsesThisWeek(subs, 'b', ref)).toBe(1)
  })
  it('counts a streak of consecutive helping days', () => {
    const today = new Date(2026, 9, 14)
    const subs = [sub({ date: '2026-10-13' }), sub({ date: '2026-10-12' }), sub({ date: '2026-10-10' })]
    expect(streak(subs, today)).toBe(2)
    subs.push(sub({ date: '2026-10-14' }))
    expect(streak(subs, today)).toBe(3)
  })
})

describe('seed data', () => {
  it('includes house-specific chores and prizes', () => {
    const items = seedItems()
    const titles = items.filter((i) => i.kind === 'chore').map((i) => (i as Chore).title.toLowerCase())
    expect(titles.some((t) => t.includes('lilo'))).toBe(true)
    expect(titles.some((t) => t.includes('reef'))).toBe(true)
    expect(titles.some((t) => t.includes('laundromat'))).toBe(true)
    expect(items.some((i) => i.kind === 'prize')).toBe(true)
    expect(items.filter((i) => i.kind === 'settings')).toHaveLength(1)
  })
  it('personalizes the daily words', () => {
    for (let d = 0; d < 40; d++) expect(wordsForToday('Maya', new Date(2026, 0, d + 1))).not.toContain('{name}')
  })
})

describe('stableKey', () => {
  it('ignores key order and undefined fields, like a jsonb round trip', () => {
    expect(stableKey({ a: 1, b: { c: [1, 'x'], d: undefined } })).toBe(stableKey({ b: { c: [1, 'x'] }, a: 1 }))
    expect(stableKey({ a: 1 })).not.toBe(stableKey({ a: 2 }))
  })
})

describe('actions', () => {
  // A local store like StoreProvider's, with a backend that only records writes.
  const setup = (initial: Item[]) => {
    let items: Record<string, Item> = Object.fromEntries(initial.map((i) => [i.id, i]))
    const writes: Item[] = []
    const backend = {
      put: async (item: Item) => void writes.push(item),
      remove: async () => undefined,
      uploadPhoto: async () => 'photo',
    } as unknown as Backend
    const apply = (c: Change) => {
      const id = c.type === 'put' ? c.item.id : c.id
      const previous = items[id]
      items = { ...items }
      if (c.type === 'put') items[id] = c.item
      else delete items[id]
      return previous
    }
    const actions = makeActions(backend, {
      get: () => derive(items),
      apply,
      restore: (id, prev) => void (prev ? apply({ type: 'put', item: prev }) : apply({ type: 'remove', id })),
    })
    return { actions, writes, data: () => derive(items) }
  }
  const prize: Prize = { id: 'p1', kind: 'prize', title: 'Toy', emoji: '🧸', points: 30, active: true, createdAt: '2026-10-14T10:00:00Z' }

  it('cannot spend the same stars twice on a double tap', async () => {
    const { actions, data } = setup([prize, entry(40)])
    const first = actions.buyPrize(prize)
    await expect(actions.buyPrize(prize)).rejects.toThrow('Not enough stars')
    await first
    expect(data().balance).toBe(10)
    expect(data().orders).toHaveLength(1)
  })

  it('pays out an approval and a refund only once', async () => {
    const s = sub({ id: 's1' })
    const { actions, data } = setup([s, prize, entry(100)])
    await Promise.all([actions.approveSubmission(s, 10), actions.approveSubmission(s, 10)])
    expect(data().balance).toBe(110)
    const order = await actions.buyPrize(prize)
    expect(data().balance).toBe(80)
    await Promise.all([actions.updateOrder(order, 'declined'), actions.updateOrder(order, 'declined')])
    expect(data().balance).toBe(110)
    expect(data().orders[0].status).toBe('declined')
  })

  it('keeps the parent note when a wish is added to the shop', async () => {
    const wish = { id: 'w1', kind: 'wish', title: 'Kite', status: 'pending', createdAt: '2026-10-14T10:00:00Z' } as const
    const { actions, data } = setup([wish])
    await actions.approveWish(wish, 50, '🪁', 'Kite', 'Great find!')
    expect(data().wishes[0].parentNote).toBe('Great find!')
    expect(data().prizes).toHaveLength(1)
  })
})
