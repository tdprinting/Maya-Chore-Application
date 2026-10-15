/** Practical tips for running a chore-and-reward system with a 9-year-old. One shows each day. */
export const PARENT_TIPS: Array<{ title: string; body: string }> = [
  { title: 'Praise the effort, not just the result', body: 'Try "You kept going even when the litter box was gross" instead of "Good girl." Naming effort builds persistence.' },
  { title: 'Be specific', body: '"You folded every sock and matched the colors" lands better than "Nice job." Specific praise tells her exactly what to repeat.' },
  { title: 'Approve quickly', body: 'Stars feel most rewarding within a few hours. A quick approval with a one-line cheer is better than a perfect review tomorrow.' },
  { title: 'Send it back kindly', body: 'When a chore needs a redo, say what "done" looks like: "Almost! The counter still has crumbs by the toaster." Then let her try again.' },
  { title: 'Do it together first', body: 'New chores (like helping with the reef tank) go best when you do them side by side a few times before she does them alone.' },
  { title: 'Keep the list short', body: 'Four to six daily chores is plenty for a 9-year-old. A list she can finish feels better than a long one she never completes.' },
  { title: 'Let her choose some chores', body: 'Offering a choice between two bonus quests gives her ownership and makes cooperation more likely.' },
  { title: 'Follow through on prizes', body: 'Buying the payday-list prize when promised is what makes the stars feel real. If something changes, tell her early and explain why.' },
  { title: 'Mix in non-toy rewards', body: 'Time with you (a scooter ride, choosing dinner, a movie pick) often means more than things, and it costs less.' },
  { title: 'Celebrate streaks out loud', body: 'Mention her helping streak at dinner. Being noticed in front of the family is a powerful reward on its own.' },
  { title: 'Name the "why"', body: 'Connect chores to the family: "When you feed Lilo, it gives me five minutes with the baby." Kids work harder when they see the impact.' },
  { title: "Don't pay for everything", body: 'Some things (being kind, clearing your own plate) are just part of being in the family. Save stars for real extra help.' },
  { title: 'Use routines, not reminders', body: 'Tie chores to existing moments: feed Lilo before breakfast, pack the school bag after dinner. Routines reduce nagging.' },
  { title: 'Model it', body: 'Let her see you doing your own "chores" cheerfully, including the laundromat runs. Kids copy attitudes more than instructions.' },
  { title: 'Big sister, big role', body: 'Give her baby-helper jobs that feel important, like picking the bedtime song. It builds pride instead of jealousy.' },
  { title: 'Keep consequences separate', body: 'Try not to take stars away as punishment. Stars work best as a positive system; handle behavior separately.' },
  { title: 'Celebrate school wins', body: 'When she shares school work, ask one question about it ("What was the hardest word?"). Interest matters more than the stars.' },
  { title: 'Review the schedule monthly', body: 'As chores get easy, swap in new ones or raise the stars for harder jobs. Growth should feel rewarded.' },
  { title: 'Use the chat for warmth', body: 'A random "thinking of you" message during the day shows her the app is about connection, not just chores.' },
  { title: 'Look at her drawings together', body: 'When she sends art, describe what you see ("I love the colors in the sky") rather than just "Pretty!"' },
  { title: 'Expect off days', body: 'Everyone has days with zero chores. A calm "Tomorrow is a new day" keeps the system from feeling like pressure.' },
  { title: 'Let her save up', body: 'Encourage her to set a goal prize. Learning to wait for something bigger is one of the best lessons the star system teaches.' },
  { title: 'Teach money thinking', body: 'Talk about how stars are like money: earn, save, choose. Ask "Is this worth 200 stars to you?" before she buys.' },
  { title: 'Keep parents on the same page', body: 'Agree on what "done" means for big chores so approvals feel fair no matter which parent reviews.' },
  { title: 'Make reviewing fun', body: 'Add a sticker or a joke in your approval note. She will look forward to reading what you wrote.' },
  { title: 'Protect sleep and play', body: 'Chores should leave plenty of time for reading, drawing, Duolingo, and just being nine.' },
  { title: 'Notice her helping without being asked', body: 'Unprompted help deserves the biggest reaction. Use "give stars" in the Family tab to reward it on the spot.' },
  { title: 'Hold a weekly check-in', body: 'Sunday is a great time to look at the week together: what went well, what was hard, and what to try next week.' },
]

/** Short encouragement for the parents themselves. */
export const PARENT_QUOTES: string[] = [
  'You are raising a kind, capable kid. The little moments count more than you think.',
  'Consistency beats perfection. Showing up most days is what she will remember.',
  'Tired parents are still great parents. Be gentle with yourselves today.',
  'Every chore she learns now is a skill she will carry for life.',
  'Connection first, correction second.',
  "Your patience today is building her confidence tomorrow.",
  'Two kids, a cat, two reef tanks and laundromat runs: you are doing a lot, and doing it well.',
  'Kids do well when they can. Help her find the "can."',
  'The goal is not a perfect house. It is a family that works together.',
  'She watches how you handle hard days. Calm is contagious.',
  'Celebrate small wins, including your own.',
  'Being present for five minutes beats being perfect for an hour.',
]

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000)
}

export function tipFor(offset = 0, date: Date = new Date()) {
  const n = PARENT_TIPS.length
  return PARENT_TIPS[(((dayOfYear(date) + offset) % n) + n) % n]
}

export function quoteFor(date: Date = new Date()): string {
  return PARENT_QUOTES[dayOfYear(date) % PARENT_QUOTES.length]
}
