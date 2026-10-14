import { nowIso, suggestPhotoBonus, suggestPoints, uid } from './logic'
import type { Chore, ChoreCategory, Effort, Item, Prize, Settings } from './types'

type ChoreSeed = [title: string, emoji: string, category: ChoreCategory, minutes: number, effort: Effort, days: number[], description?: string]

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]
const SCHOOL_DAYS = [1, 2, 3, 4, 5]

/** Chores that fit Maya's home: Lilo the cat, two reef tanks, a baby sister, laundromat trips. */
export const CHORE_SEEDS: ChoreSeed[] = [
  ["Feed Lilo breakfast", '🐈', 'kitty', 3, 1, EVERY_DAY, 'Scoop her food and give her a pat.'],
  ["Fresh water for Lilo", '💧', 'kitty', 2, 1, EVERY_DAY, 'Rinse her bowl and fill it with cool water.'],
  ["Scoop Lilo's litter box", '🪣', 'kitty', 5, 2, [1, 3, 5], 'Scoop, bag it, and wash your hands.'],
  ["Brush Lilo", '🪮', 'kitty', 5, 1, [6]],
  ["Play time with Lilo", '🧶', 'kitty', 10, 1, []],
  ['Feed the reef fish', '🐠', 'reef', 3, 1, EVERY_DAY, 'Just a pinch! Ask a grown-up how much.'],
  ['Check the reef tank water level', '🌊', 'reef', 3, 1, [2, 5], 'Look at the line and tell a grown-up if it is low.'],
  ['Wipe the reef tank glass (outside)', '✨', 'reef', 10, 2, [6]],
  ['Help with a reef water change', '🪸', 'reef', 25, 3, []],
  ['Bring diapers and wipes to a grown-up', '🍼', 'baby', 2, 1, []],
  ['Sing or read to the baby', '🎶', 'baby', 10, 1, [2, 4], 'Your choir voice is her favorite!'],
  ["Tidy the baby's toys", '🧸', 'baby', 10, 2, [0, 3]],
  ['Fold baby clothes', '👶', 'baby', 15, 2, []],
  ['Pack the laundromat bag', '🧺', 'laundry', 10, 2, [6], 'Sort lights and darks into the bags.'],
  ['Help at the laundromat', '🫧', 'laundry', 30, 3, [6], 'Load machines, push buttons, and keep track of quarters.'],
  ['Fold and put away your clothes', '👕', 'laundry', 15, 2, [0]],
  ['Match the socks', '🧦', 'laundry', 10, 1, []],
  ['Make your bed', '🛏️', 'bedroom', 3, 1, EVERY_DAY],
  ['Tidy your room', '🧹', 'bedroom', 15, 2, [3, 0]],
  ['Pack your school bag', '🎒', 'bedroom', 5, 1, [0, 1, 2, 3, 4]],
  ['Put dirty clothes in the hamper', '🧺', 'bedroom', 2, 1, EVERY_DAY],
  ['Set the table', '🍽️', 'kitchen', 5, 1, SCHOOL_DAYS],
  ['Clear the table', '🧽', 'kitchen', 5, 1, [0, 6]],
  ['Unload the dishwasher', '🥣', 'kitchen', 10, 2, []],
  ['Wipe the counters', '🧼', 'kitchen', 5, 1, []],
  ['Help cook dinner', '👩‍🍳', 'kitchen', 20, 2, []],
  ['Take out the trash', '🗑️', 'cleaning', 5, 2, [2, 5]],
  ['Water the plants', '🪴', 'outdoor', 5, 1, [1, 4]],
  ['Dust the living room', '🪶', 'cleaning', 10, 2, []],
  ['Sweep the kitchen', '🧹', 'cleaning', 10, 2, []],
  ['Wipe the bathroom sink', '🚿', 'cleaning', 5, 2, []],
  ['Put away groceries', '🛒', 'kitchen', 10, 2, []],
  ['Put your scooter and helmet away', '🛴', 'outdoor', 3, 1, []],
]

/** Extra ways to earn stars through the week. */
export const BONUS_SEEDS: ChoreSeed[] = [
  ['Read for 20 minutes', '📚', 'learning', 20, 1, [], 'Any book you like! Tell us about it.'],
  ['Finish your Duolingo lesson', '🦉', 'learning', 10, 1, [], 'Keep that streak going, ¡muy bien!'],
  ['Typing game practice', '⌨️', 'learning', 15, 1, [], 'Beat your best words-per-minute.'],
  ['Practice your choir songs', '🎤', 'learning', 15, 2, []],
  ['Draw a picture for the family', '🎨', 'kindness', 20, 1, [], 'Snap a photo so we can see it!'],
  ['Watch the baby while a grown-up showers', '👀', 'baby', 15, 2, []],
  ['Make the baby laugh', '😂', 'baby', 5, 1, []],
  ['Help without being asked', '💖', 'kindness', 10, 2, []],
  ['Write a kind note to someone', '💌', 'kindness', 10, 1, []],
  ['Screen-free hour', '🌞', 'kindness', 60, 1, [], 'Play, draw, read, or go outside.'],
  ['Clean out your backpack', '🎒', 'bedroom', 10, 2, []],
  ['Wash and check your scooter', '🛴', 'outdoor', 15, 2, []],
  ['Great job at road crossing duty', '🦺', 'family', 15, 2, [], 'Keeping friends safe is a big deal!'],
  ['Learn 5 new words in a new language', '🌍', 'learning', 15, 2, []],
  ['Teach the family something new', '🧑‍🏫', 'learning', 15, 2, []],
]

const PRIZE_SEEDS: Array<[string, string, number, number]> = [
  ['Pick the family movie night movie', '🎬', 0, 100],
  ['30 extra minutes of tablet time', '📱', 0, 120],
  ['Stay up 30 minutes late (weekend)', '🌙', 0, 150],
  ['Kitty sticker pack', '🎀', 5, 125],
  ['Ice cream date', '🍦', 6, 150],
  ['Long scooter ride adventure with a parent', '🛴', 0, 200],
  ['New set of markers or gel pens', '🖍️', 8, 200],
  ['Choose dinner for the family', '🍕', 0, 250],
  ['A new chapter book', '📖', 10, 250],
  ['Sketchbook and drawing kit', '✏️', 15, 380],
  ['Blue alien plush buddy', '👽', 20, 500],
  ['Trip to the aquarium', '🐟', 40, 1000],
]

export function makeChore(seed: ChoreSeed, type: 'chore' | 'bonus'): Chore {
  const [title, emoji, category, minutes, effort, days, description] = seed
  const points = suggestPoints(minutes, effort)
  return {
    id: uid(),
    kind: 'chore',
    type,
    title,
    emoji,
    category,
    description,
    minutes,
    effort,
    points,
    photoBonus: suggestPhotoBonus(points),
    days: type === 'chore' ? days : [],
    perWeek: type === 'bonus' ? 3 : undefined,
    active: type === 'bonus',
    createdAt: nowIso(),
  }
}

export function defaultSettings(): Settings {
  return { id: 'settings', kind: 'settings', kidName: 'Maya', currency: 'Ohana Stars', theme: 'kitty', sounds: true }
}

export function seedItems(): Item[] {
  const prizes: Prize[] = PRIZE_SEEDS.map(([title, emoji, price, points]) => ({
    id: uid(),
    kind: 'prize',
    title,
    emoji,
    price: price || undefined,
    points,
    active: true,
    createdAt: nowIso(),
  }))
  return [
    defaultSettings(),
    ...CHORE_SEEDS.map((s) => makeChore(s, 'chore')),
    ...BONUS_SEEDS.map((s) => makeChore(s, 'bonus')),
    ...prizes,
    {
      id: uid(),
      kind: 'note',
      text: 'We are so proud of you, Maya! Thank you for helping our ohana. Love, Mom & Dad',
      from: 'Mom & Dad',
      createdAt: nowIso(),
    },
  ]
}

export const CATEGORY_LABELS: Record<ChoreCategory, string> = {
  kitty: 'Lilo the Cat',
  reef: 'Reef Tanks',
  baby: 'Baby Sister',
  laundry: 'Laundry',
  kitchen: 'Kitchen',
  bedroom: 'My Room',
  cleaning: 'Cleaning',
  outdoor: 'Outside',
  family: 'Family & Community',
  learning: 'Learning',
  kindness: 'Kindness',
}

export const EMOJI_CHOICES = [
  '⭐', '🐈', '🐠', '🪸', '🍼', '🧺', '🧦', '🛏️', '🧹', '🍽️', '🧽', '🗑️', '🪴', '📚', '🦉', '⌨️', '🎤',
  '🎨', '💖', '💌', '🛴', '🎒', '🌺', '🎀', '👽', '🌊', '🍦', '🎬', '📱', '🎁', '🧸', '🐟', '🏖️', '🍕',
]
