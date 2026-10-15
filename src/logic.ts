import type { Chore, Effort, Item, LedgerEntry, Mood, MoodLevel, Order, Prize, Submission } from './types'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Local calendar date as YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Sunday that starts the week containing `d`, as YYYY-MM-DD. */
export function weekStartKey(d: Date = new Date()): string {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  s.setDate(s.getDate() - s.getDay())
  return dayKey(s)
}

export function sameWeek(key: string, ref: Date = new Date()): boolean {
  return weekStartKey(parseDayKey(key)) === weekStartKey(ref)
}

export const EFFORT_LABELS: Record<Effort, string> = {
  1: 'Easy peasy',
  2: 'Some effort',
  3: 'Big job',
}

const EFFORT_MULTIPLIER: Record<Effort, number> = { 1: 1, 2: 1.5, 3: 2 }

/**
 * Suggested stars for a chore: about one star per minute, scaled up for harder work,
 * rounded to a friendly number. Parents can always change it.
 */
export function suggestPoints(minutes: number, effort: Effort): number {
  const m = Math.max(1, Math.min(180, Math.round(minutes || 0)))
  const raw = m * EFFORT_MULTIPLIER[effort]
  if (raw <= 10) return Math.max(2, Math.round(raw))
  return Math.round(raw / 5) * 5
}

/** Suggested photo bonus: a quarter extra, at least 2 stars. */
export function suggestPhotoBonus(points: number): number {
  return Math.max(2, Math.round(points * 0.25))
}

export const STARS_PER_DOLLAR = 25

/**
 * Suggested price in stars for a prize that costs `dollars`. A full week of chores
 * earns roughly 400-500 stars, so this works out to about $15-20 of prizes a week.
 */
export function suggestPrizePoints(dollars: number): number {
  const raw = Math.max(0.2, dollars || 0) * STARS_PER_DOLLAR
  return raw < 100 ? Math.max(5, Math.round(raw / 5) * 5) : Math.round(raw / 10) * 10
}

export function balance(ledger: LedgerEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.amount, 0)
}

export function pointsFor(sub: Pick<Submission, 'basePoints' | 'photoBonus' | 'photo'>): number {
  return sub.basePoints + (sub.photo ? sub.photoBonus : 0)
}

/** Chores on Maya's list for a given day. */
export function choresForDay(chores: Chore[], d: Date = new Date()): Chore[] {
  const dow = d.getDay()
  return chores.filter((c) => c.type === 'chore' && c.days.includes(dow))
}

export function bonusQuests(chores: Chore[]): Chore[] {
  return chores.filter((c) => c.type === 'bonus' && c.active)
}

/** The latest submission for a chore on a given day that wasn't sent back. */
export function submissionForDay(subs: Submission[], choreId: string, key: string): Submission | undefined {
  return subs
    .filter((s) => s.choreId === choreId && s.date === key && s.status !== 'rejected')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export function bonusUsesThisWeek(subs: Submission[], choreId: string, ref: Date = new Date()): number {
  return subs.filter((s) => s.choreId === choreId && s.status !== 'rejected' && sameWeek(s.date, ref)).length
}

/**
 * Consecutive days (ending today, or yesterday if today has nothing yet)
 * with at least one approved or pending chore, bonus or homework.
 */
export function streak(subs: Submission[], today: Date = new Date()): number {
  const days = new Set(subs.filter((s) => s.status !== 'rejected').map((s) => s.date))
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export interface Level {
  level: number
  title: string
  emoji: string
  floor: number
  next: number
}

const LEVELS: Array<[number, string, string]> = [
  [0, 'Little Helper', '🐣'],
  [100, 'Kitty Cadet', '🐱'],
  [250, 'Hula Hero', '🌺'],
  [500, 'Reef Ranger', '🐠'],
  [900, 'Ohana Champion', '🏅'],
  [1400, 'Super Big Sister', '🦸‍♀️'],
  [2000, 'Galaxy Star', '🌟'],
  [3000, 'Experiment Legend', '👽'],
  [5000, 'Queen of the Islands', '👑'],
]

/** Level from lifetime stars earned (spending never lowers it). */
export function levelFor(lifetime: number): Level {
  let i = 0
  while (i + 1 < LEVELS.length && lifetime >= LEVELS[i + 1][0]) i++
  const [floor, title, emoji] = LEVELS[i]
  const next = i + 1 < LEVELS.length ? LEVELS[i + 1][0] : floor
  return { level: i + 1, title, emoji, floor, next }
}

export function lifetimeEarned(ledger: LedgerEntry[]): number {
  return ledger.filter((e) => e.amount > 0 && !e.refId?.startsWith('refund:')).reduce((s, e) => s + e.amount, 0)
}

export interface Badge {
  id: string
  title: string
  emoji: string
  description: string
  earned: boolean
  progress: number
  goal: number
}

export function badges(subs: Submission[], chores: Chore[], orders: Order[], streakDays: number): Badge[] {
  const approved = subs.filter((s) => s.status === 'approved')
  const byCategory = (cat: string) =>
    approved.filter((s) => chores.find((c) => c.id === s.choreId)?.category === cat).length
  const photos = approved.filter((s) => s.photo).length
  const homework = approved.filter((s) => s.type === 'homework').length
  const bonus = approved.filter((s) => s.type === 'bonus').length
  const defs: Array<Omit<Badge, 'earned'>> = [
    { id: 'first', title: 'First Star', emoji: '⭐', description: 'Get your first chore approved', progress: approved.length, goal: 1 },
    { id: 'kitty', title: "Lilo's Best Friend", emoji: '🐈', description: 'Take care of Lilo 10 times', progress: byCategory('kitty'), goal: 10 },
    { id: 'reef', title: 'Reef Keeper', emoji: '🐠', description: 'Help with the reef tanks 5 times', progress: byCategory('reef'), goal: 5 },
    { id: 'baby', title: 'Super Big Sister', emoji: '🍼', description: 'Help with the baby 10 times', progress: byCategory('baby'), goal: 10 },
    { id: 'laundry', title: 'Laundromat Pro', emoji: '🧺', description: 'Help with laundry 5 times', progress: byCategory('laundry'), goal: 5 },
    { id: 'photo', title: 'Shutterbug', emoji: '📸', description: 'Send 10 proof photos', progress: photos, goal: 10 },
    { id: 'school', title: 'Brainiac', emoji: '🧠', description: 'Share 5 awesome school works', progress: homework, goal: 5 },
    { id: 'bonus', title: 'Bonus Boss', emoji: '🚀', description: 'Finish 10 bonus quests', progress: bonus, goal: 10 },
    { id: 'streak7', title: 'Week of Awesome', emoji: '🔥', description: 'Help 7 days in a row', progress: streakDays, goal: 7 },
    { id: 'shopper', title: 'Treat Yourself', emoji: '🎁', description: 'Buy your first prize', progress: orders.filter((o) => o.status !== 'declined').length, goal: 1 },
  ]
  return defs.map((b) => ({ ...b, progress: Math.min(b.progress, b.goal), earned: b.progress >= b.goal }))
}

export function byNewest<T extends { createdAt: string }>(a: T, b: T): number {
  return b.createdAt.localeCompare(a.createdAt)
}

export function canAfford(bal: number, prize: Prize): boolean {
  return bal >= prize.points
}

export function ofKind<K extends Item['kind']>(items: Item[], kind: K): Extract<Item, { kind: K }>[] {
  return items.filter((i): i is Extract<Item, { kind: K }> => i.kind === kind)
}

/**
 * A key that is the same for two items with the same content, whatever order their keys are in
 * (Postgres jsonb reorders keys) and whether optional fields are missing or undefined.
 */
export function stableKey(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableKey(v))).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableKey(obj[k])}`).join(',')}}`
}

// ---------------------------------------------------------------------------
// Daily Lucky Spin

/** Stars on the wheel, and how likely each one is (out of 100). Small prizes come up most. */
export const SPIN_WEIGHTS: ReadonlyArray<readonly [stars: number, weight: number]> = [
  [1, 20],
  [2, 18],
  [3, 16],
  [4, 13],
  [5, 10],
  [6, 8],
  [7, 6],
  [8, 4],
  [9, 3],
  [10, 2],
]

/** Turns a random number in [0, 1) into a prize of 1 to 10 stars, weighted toward small ones. */
export function pickSpin(r: number): number {
  const total = SPIN_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  let x = Math.min(Math.max(r, 0), 0.999999) * total
  for (const [stars, w] of SPIN_WEIGHTS) {
    if (x < w) return stars
    x -= w
  }
  return SPIN_WEIGHTS[SPIN_WEIGHTS.length - 1][0]
}

/** The ledger refId that marks the Lucky Spin for a day. */
export function spinRef(day: string): string {
  return `spin:${day}`
}

/** Today's Lucky Spin entry, if Maya already spun. */
export function spinForDay(ledger: LedgerEntry[], day: string = dayKey()): LedgerEntry | undefined {
  return ledger.find((e) => e.refId === spinRef(day))
}

// ---------------------------------------------------------------------------
// Feelings check-in

export interface MoodInfo {
  level: MoodLevel
  label: string
  emoji: string
  color: string
  /** What Lilo says back. */
  reply: string
}

export const MOODS: MoodInfo[] = [
  { level: 1, label: 'Sad', emoji: '😢', color: '#6ec6f0', reply: 'Big kitty hugs! Mom & Dad are always here for you. 💙' },
  { level: 2, label: 'Grumpy', emoji: '😤', color: '#a98bff', reply: 'Grumpy days happen. Want a cuddle or a snack? 💜' },
  { level: 3, label: 'Okay', emoji: '🙂', color: '#7ee0c3', reply: 'Okay is okay! Let’s find something fun today. 🌴' },
  { level: 4, label: 'Happy', emoji: '😊', color: '#ffd84d', reply: 'Yay! Your smile makes Lilo purr! 💛' },
  { level: 5, label: 'Super happy', emoji: '🤩', color: '#ff6fae', reply: 'WOW! Sparkly super day! Let’s celebrate! 💖' },
]

export function moodInfo(level: MoodLevel): MoodInfo {
  return MOODS[Math.min(5, Math.max(1, level)) - 1]
}

export function moodForDay(moods: Mood[], day: string = dayKey()): Mood | undefined {
  return moods.find((m) => m.date === day)
}

/** The last `n` local days, oldest first, ending today. */
export function lastDays(n: number, today: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)))
  return out
}
