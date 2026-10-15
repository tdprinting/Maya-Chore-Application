export type Role = 'parent' | 'kid'

export type Effort = 1 | 2 | 3

export type ChoreCategory =
  | 'kitty'
  | 'reef'
  | 'baby'
  | 'laundry'
  | 'kitchen'
  | 'bedroom'
  | 'cleaning'
  | 'outdoor'
  | 'family'
  | 'learning'
  | 'kindness'

/** A chore (scheduled on days of the week) or a bonus quest (available all week). */
export interface Chore {
  id: string
  kind: 'chore'
  type: 'chore' | 'bonus'
  title: string
  emoji: string
  category: ChoreCategory
  description?: string
  minutes: number
  effort: Effort
  points: number
  photoBonus: number
  /** Days of the week this chore is on Maya's list (0 = Sunday). Empty = in the catalogue only. */
  days: number[]
  /** Bonus quests: how many times per week Maya can earn it. */
  perWeek?: number
  /** Bonus quests the parents switched on for this week. */
  active: boolean
  createdAt: string
}

export type SubmissionType = 'chore' | 'bonus' | 'homework'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface Submission {
  id: string
  kind: 'submission'
  type: SubmissionType
  choreId?: string
  title: string
  emoji: string
  /** Local date this counts for, YYYY-MM-DD. */
  date: string
  photo?: string
  note?: string
  status: SubmissionStatus
  basePoints: number
  photoBonus: number
  pointsAwarded?: number
  parentNote?: string
  createdAt: string
  reviewedAt?: string
}

export interface Prize {
  id: string
  kind: 'prize'
  title: string
  emoji: string
  description?: string
  link?: string
  photo?: string
  price?: number
  points: number
  active: boolean
  createdAt: string
}

export type OrderStatus = 'requested' | 'approved' | 'purchased' | 'delivered' | 'declined'

/** Maya spending her stars on a prize. Parents buy it on the next paycheck. */
export interface Order {
  id: string
  kind: 'order'
  prizeId: string
  title: string
  emoji: string
  link?: string
  price?: number
  points: number
  status: OrderStatus
  parentNote?: string
  createdAt: string
  updatedAt?: string
}

export type WishStatus = 'pending' | 'added' | 'declined'

/** Something Maya found online and wants added to the prize shop. */
export interface Wish {
  id: string
  kind: 'wish'
  title: string
  link?: string
  price?: number
  note?: string
  photo?: string
  status: WishStatus
  parentNote?: string
  createdAt: string
}

export interface LedgerEntry {
  id: string
  kind: 'ledger'
  amount: number
  reason: string
  emoji: string
  refId?: string
  createdAt: string
}

export interface LoveNote {
  id: string
  kind: 'note'
  text: string
  from: string
  createdAt: string
}

/** A chat bubble between Maya and her parents. */
export interface ChatMessage {
  id: string
  kind: 'message'
  from: 'kid' | 'parent'
  author: string
  text: string
  /** A big sticker emoji sent on its own. */
  sticker?: string
  /** A drawing or picture attached to the message. */
  photo?: string
  createdAt: string
}

export type MoodLevel = 1 | 2 | 3 | 4 | 5

/** Maya's daily feelings check-in. One per day: id is `mood-YYYY-MM-DD` (plus the family). */
export interface Mood {
  id: string
  kind: 'mood'
  /** Local date, YYYY-MM-DD. */
  date: string
  mood: MoodLevel
  note?: string
  createdAt: string
  updatedAt?: string
}

export interface Settings {
  id: 'settings'
  kind: 'settings'
  kidName: string
  currency: string
  /** SHA-256 of the parent PIN, used to open the parent area from Maya's iPad. */
  parentPinHash?: string
  goalPrizeId?: string
  theme: 'kitty' | 'ohana'
  sounds: boolean
}

export type Item = Chore | Submission | Prize | Order | Wish | LedgerEntry | LoveNote | ChatMessage | Mood | Settings

export type Kind = Item['kind']
