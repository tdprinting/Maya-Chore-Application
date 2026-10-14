import { describe, expect, it } from 'vitest'
import { wordsForToday } from './encouragement'
import {
  balance,
  bonusUsesThisWeek,
  choresForDay,
  levelFor,
  lastDays,
  lifetimeEarned,
  pickSpin,
  pointsFor,
  SPIN_WEIGHTS,
  streak,
  submissionForDay,
  suggestPhotoBonus,
  suggestPoints,
  suggestPrizePoints,
  stableKey,
  weekStartKey,
} from './logic'
import { seedItems } from './seed'
import { STICKERS, stickerCollection, stickerFor } from './fun/stickers'
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

describe('lucky spin', () => {
  it('always lands on 1 to 10 stars', () => {
    expect(pickSpin(0)).toBe(1)
    expect(pickSpin(0.999999)).toBe(10)
    expect(pickSpin(1)).toBe(10)
    expect(pickSpin(-1)).toBe(1)
    for (let i = 0; i < 500; i++) {
      const n = pickSpin(Math.random())
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(10)
    }
  })

  it('is weighted toward small prizes', () => {
    expect(SPIN_WEIGHTS.reduce((s, [, w]) => s + w, 0)).toBe(100)
    const counts = new Map<number, number>()
    const steps = 10_000
    for (let i = 0; i < steps; i++) {
      const n = pickSpin(i / steps)
      counts.set(n, (counts.get(n) ?? 0) + 1)
    }
    expect(counts.get(1)).toBeGreaterThan(counts.get(5)!)
    expect(counts.get(5)).toBeGreaterThan(counts.get(10)!)
    const small = [1, 2, 3].reduce((s, n) => s + (counts.get(n) ?? 0), 0)
    expect(small / steps).toBeGreaterThan(0.5)
    let mean = 0
    for (const [n, c] of counts) mean += (n * c) / steps
    expect(mean).toBeLessThan(4)
  })
})

describe('stickers', () => {
  it('gives the same sticker for the same submission', () => {
    expect(stickerFor('abc-123')).toBe(stickerFor('abc-123'))
    expect(STICKERS).toContain(stickerFor('anything'))
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length)
  })

  it('makes sparkly stickers rare', () => {
    const tiers = { common: 0, rare: 0, sparkly: 0 }
    const seen = new Set<string>()
    for (let i = 0; i < 4000; i++) {
      const s = stickerFor(`sub-${i}`)
      tiers[s.rarity]++
      seen.add(s.id)
    }
    expect(tiers.common).toBeGreaterThan(tiers.rare)
    expect(tiers.rare).toBeGreaterThan(tiers.sparkly)
    expect(tiers.sparkly).toBeGreaterThan(0)
    // Every sticker can be found eventually.
    expect(seen.size).toBe(STICKERS.length)
  })

  it('collects stickers from approved work only', () => {
    const subs = [sub({ id: 'a', status: 'approved' }), sub({ id: 'a2', status: 'pending' }), sub({ id: 'b', status: 'rejected' })]
    const col = stickerCollection(subs)
    expect([...col.values()].reduce((s, c) => s + c.count, 0)).toBe(1)
    expect(col.has(stickerFor('a').id)).toBe(true)
  })
})

describe('daily fun actions', () => {
  const ledgerOnly = (items: Item[]) => {
    let map: Record<string, Item> = Object.fromEntries(items.map((i) => [i.id, i]))
    const backend = { put: async () => undefined, remove: async () => undefined } as unknown as Backend
    const apply = (c: Change) => {
      const id = c.type === 'put' ? c.item.id : c.id
      const prev = map[id]
      map = { ...map }
      if (c.type === 'put') map[id] = c.item
      else delete map[id]
      return prev
    }
    const actions = makeActions(backend, { get: () => derive(map), apply, restore: () => undefined }, 'fam1')
    return { actions, data: () => derive(map) }
  }

  it('pays the Lucky Spin once a day', async () => {
    const { actions, data } = ledgerOnly([])
    const first = await actions.spinWheel('2026-10-14', 0)
    const again = await actions.spinWheel('2026-10-14', 0.99)
    expect(first).toEqual({ stars: 1, already: false })
    expect(again).toEqual({ stars: 1, already: true })
    expect(data().balance).toBe(1)
    expect(data().ledger[0].id).toBe('spin-2026-10-14-fam1')
    await actions.spinWheel('2026-10-15', 0.99)
    expect(data().balance).toBe(11)
    await actions.resetSpin('2026-10-15')
    expect(data().balance).toBe(1)
  })

  it('keeps one mood per day', async () => {
    const { actions, data } = ledgerOnly([])
    await actions.checkInMood(4, ' yay ', '2026-10-14')
    await actions.checkInMood(2, '', '2026-10-14')
    expect(data().moods).toHaveLength(1)
    expect(data().moods[0]).toMatchObject({ id: 'mood-2026-10-14-fam1', mood: 2, note: undefined })
    expect(lastDays(7, new Date(2026, 9, 14))).toEqual([
      '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14',
    ])
  })
})
