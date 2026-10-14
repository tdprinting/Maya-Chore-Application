import type { LoveNote } from './types'

/** One of these greets Maya each day. {name} is replaced with her name. */
export const DAILY_WORDS: string[] = [
  "Ohana means family, and our family is so lucky to have you, {name}!",
  "Your brain is super powerful. You can learn anything you put your mind to!",
  "Mistakes are proof you are trying. Keep going, superstar!",
  "Your little sister looks up to you every single day. You are her hero!",
  "Kindness is your superpower, {name}. The world is brighter because of you.",
  "Every page you read makes your imagination bigger. Keep reading!",
  "Lilo the cat thinks you are the best human ever. So do we!",
  "Brave doesn't mean not scared. It means trying anyway. You are brave!",
  "Your voice in choir makes the whole song shine. Sing loud and proud!",
  "Helping out shows how big your heart is. Thank you, {name}!",
  "You keep your friends safe at road crossing. That is real leadership!",
  "Small steps every day make big dreams come true.",
  "You are smart, you are kind, and you are loved. Never forget it!",
  "Your drawings make our home happier. Keep creating!",
  "Learning a new language is like unlocking a secret door. ¡Eres increíble!",
  "When you help the family, the whole house smiles. Thank you!",
  "You are one of a kind, {name}. Nobody else can be you, and that is awesome.",
  "Hard things become easy things with practice. You've got this!",
  "Your family loves you to the moon, around the stars, and back again.",
  "Being a good big sister is one of the most important jobs there is. You rock it!",
  "Curious minds change the world. Keep asking questions!",
  "Your fingers fly on that keyboard! Practice really pays off.",
  "Even on tough days, you are still amazing. We believe in you.",
  "A happy reef needs care, and so does a happy family. Thanks for caring!",
  "You make us laugh, you make us proud, and you make us so happy.",
  "Do your best, then be proud of it. That is all anyone can ask!",
  "Your hard work today is a gift to your future self.",
  "Every time you help, you earn stars and our hearts get bigger.",
  "You are growing into such a thoughtful, clever, wonderful person.",
  "Scooter rides, good books, and you: the best things in life!",
  "Remember: nobody gets left behind or forgotten. You are our ohana!",
]

/** Today's words of encouragement, the same all day, different every day. */
export function wordsForToday(name: string, date: Date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  return DAILY_WORDS[dayOfYear % DAILY_WORDS.length].split('{name}').join(name)
}

/** A love note from the parents picked for today, if they wrote any. */
export function noteForToday(notes: LoveNote[], date: Date = new Date()): LoveNote | undefined {
  if (!notes.length) return undefined
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  // Fresh notes (last 2 days) always show first; otherwise rotate by day.
  const fresh = sorted.find((n) => date.getTime() - new Date(n.createdAt).getTime() < 2 * 86_400_000)
  if (fresh) return fresh
  return sorted[date.getDate() % sorted.length]
}

export const CHEERS = [
  'Aloha, awesome!',
  'You did it!',
  'Super helper!',
  'Way to go!',
  'Stellar job!',
  'Ohana power!',
  'Purr-fect!',
  'Totally rad!',
  'Amazing work!',
  'High five!',
]

export function randomCheer(): string {
  return CHEERS[Math.floor(Math.random() * CHEERS.length)]
}
