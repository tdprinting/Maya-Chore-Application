import type { Submission } from '../types'

export type Rarity = 'common' | 'rare' | 'sparkly'

export interface StickerTheme {
  id: string
  title: string
  emoji: string
  /** Page color in the album. */
  color: string
  soft: string
}

export interface Sticker {
  id: string
  name: string
  emoji: string
  theme: string
  rarity: Rarity
}

export const STICKER_THEMES: StickerTheme[] = [
  { id: 'cats', title: 'Kitty Corner', emoji: '🐱', color: '#ff6fae', soft: '#ffd6e8' },
  { id: 'tropical', title: 'Island Blooms', emoji: '🌺', color: '#ff7a7a', soft: '#ffe3e3' },
  { id: 'ocean', title: 'Reef Friends', emoji: '🐠', color: '#6ec6f0', soft: '#e3f4fd' },
  { id: 'space', title: 'Outer Space', emoji: '👽', color: '#2f4a8a', soft: '#dfe6f7' },
  { id: 'bows', title: 'Bows & Bling', emoji: '🎀', color: '#e0508f', soft: '#ffe3ef' },
  { id: 'sweets', title: 'Sweet Treats', emoji: '🧁', color: '#a98bff', soft: '#ece4ff' },
  { id: 'music', title: 'Music Time', emoji: '🎵', color: '#4cc4a0', soft: '#dcf8ef' },
  { id: 'books', title: 'Story Books', emoji: '📚', color: '#e6b71e', soft: '#fff3c4' },
  { id: 'wheels', title: 'Zoom Zoom', emoji: '🛴', color: '#4aa8d8', soft: '#e3f4fd' },
]

const S = (theme: string, rarity: Rarity, emoji: string, name: string, id: string): Sticker => ({ id, name, emoji, theme, rarity })

/** Every sticker Maya can collect. Ids are permanent: never rename or reorder by id. */
export const STICKERS: Sticker[] = [
  S('cats', 'common', '🐱', 'Kitty Face', 'cat-face'),
  S('cats', 'common', '🐾', 'Paw Prints', 'cat-paws'),
  S('cats', 'common', '😺', 'Grinny Kitty', 'cat-grin'),
  S('cats', 'rare', '🐈', 'Lilo the Cat', 'cat-lilo'),
  S('cats', 'sparkly', '😻', 'Heart-Eyes Kitty', 'cat-love'),

  S('tropical', 'common', '🌺', 'Hibiscus', 'trop-hibiscus'),
  S('tropical', 'common', '🌴', 'Palm Tree', 'trop-palm'),
  S('tropical', 'common', '🍍', 'Pineapple', 'trop-pineapple'),
  S('tropical', 'rare', '🥥', 'Coconut', 'trop-coconut'),
  S('tropical', 'sparkly', '🌈', 'Island Rainbow', 'trop-rainbow'),

  S('ocean', 'common', '🐠', 'Reef Fish', 'sea-fish'),
  S('ocean', 'common', '🐚', 'Seashell', 'sea-shell'),
  S('ocean', 'common', '🦀', 'Crabby', 'sea-crab'),
  S('ocean', 'common', '🐡', 'Puffer Fish', 'sea-puffer'),
  S('ocean', 'rare', '🐢', 'Sea Turtle', 'sea-turtle'),
  S('ocean', 'sparkly', '🐙', 'Octopus Pal', 'sea-octopus'),

  S('space', 'common', '🚀', 'Rocket', 'space-rocket'),
  S('space', 'common', '🌙', 'Moon', 'space-moon'),
  S('space', 'common', '🛸', 'Flying Saucer', 'space-ufo'),
  S('space', 'rare', '🪐', 'Ringed Planet', 'space-planet'),
  S('space', 'sparkly', '👽', 'Experiment 626', 'space-alien'),

  S('bows', 'common', '🎀', 'Pink Bow', 'bow-pink'),
  S('bows', 'common', '💝', 'Bow Heart', 'bow-heart'),
  S('bows', 'rare', '👑', 'Tiara', 'bow-tiara'),
  S('bows', 'sparkly', '💖', 'Sparkle Heart', 'bow-sparkle'),

  S('sweets', 'common', '🍩', 'Donut', 'sweet-donut'),
  S('sweets', 'common', '🍓', 'Strawberry', 'sweet-berry'),
  S('sweets', 'common', '🍦', 'Ice Cream', 'sweet-icecream'),
  S('sweets', 'rare', '🧁', 'Cupcake', 'sweet-cupcake'),
  S('sweets', 'sparkly', '🍧', 'Shave Ice', 'sweet-shaveice'),

  S('music', 'common', '🎵', 'Music Note', 'music-note'),
  S('music', 'common', '🥁', 'Drum', 'music-drum'),
  S('music', 'rare', '🎸', 'Ukulele Jam', 'music-uke'),
  S('music', 'sparkly', '🎤', 'Choir Star', 'music-mic'),

  S('books', 'common', '📚', 'Book Stack', 'book-stack'),
  S('books', 'common', '✏️', 'Pencil', 'book-pencil'),
  S('books', 'rare', '🖍️', 'Crayon', 'book-crayon'),
  S('books', 'sparkly', '📖', 'Story Time', 'book-story'),

  S('wheels', 'common', '🛴', 'Scooter', 'wheel-scooter'),
  S('wheels', 'common', '🚲', 'Bike', 'wheel-bike'),
  S('wheels', 'rare', '🛼', 'Roller Skate', 'wheel-skate'),
  S('wheels', 'sparkly', '🛹', 'Skateboard', 'wheel-board'),
]

export const STICKER_BY_ID: Record<string, Sticker> = Object.fromEntries(STICKERS.map((s) => [s.id, s]))

/** How likely each tier is, out of 100. */
export const RARITY_WEIGHTS: Record<Rarity, number> = { common: 72, rare: 21, sparkly: 7 }

export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', sparkly: 'Sparkly!' }

/** 32-bit FNV-1a, then a murmur-style finish so close ids land far apart. */
function hash(text: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** The sticker an approved submission earns. Always the same for the same submission id. */
export function stickerFor(submissionId: string): Sticker {
  const roll = hash(submissionId) % 100
  const rarity: Rarity = roll < RARITY_WEIGHTS.common ? 'common' : roll < RARITY_WEIGHTS.common + RARITY_WEIGHTS.rare ? 'rare' : 'sparkly'
  const tier = STICKERS.filter((s) => s.rarity === rarity)
  return tier[hash(submissionId, 0x9e3779b9) % tier.length]
}

export interface CollectedSticker {
  sticker: Sticker
  count: number
  /** When the first one arrived. */
  firstAt: string
}

/** Stickers Maya owns, from her approved chores, bonus quests and school stars. */
export function stickerCollection(subs: Submission[]): Map<string, CollectedSticker> {
  const out = new Map<string, CollectedSticker>()
  const approved = subs.filter((s) => s.status === 'approved')
  for (const s of approved) {
    const sticker = stickerFor(s.id)
    const at = s.reviewedAt ?? s.createdAt
    const cur = out.get(sticker.id)
    if (!cur) out.set(sticker.id, { sticker, count: 1, firstAt: at })
    else out.set(sticker.id, { sticker, count: cur.count + 1, firstAt: at < cur.firstAt ? at : cur.firstAt })
  }
  return out
}

// Which stickers have been peeled on this device. Per device on purpose: each iPad gets its own reveal.
const SEEN_KEY = 'ohana-stickers-seen'

export function loadSeenStickers(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function saveSeenStickers(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    /* private mode: peel again next time */
  }
  window.dispatchEvent(new Event(SEEN_KEY))
}

export function resetSeenStickers() {
  saveSeenStickers(new Set())
}

export const SEEN_EVENT = SEEN_KEY
