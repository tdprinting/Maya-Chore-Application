import { useState } from 'react'
import { BigCelebration, FloatingPoints } from '../components'
import { bigWin, smallWin, sounds } from '../fx'
import { LuckySpinOverlay } from '../fun/LuckySpin'
import { RARITY_LABEL, resetSeenStickers, stickerFor } from '../fun/stickers'
import { MOODS, choresForDay, dayKey, moodInfo, pointsFor, spinForDay, uid } from '../logic'
import { useStore } from '../store'

/** A fake "photo" so photo features can be tested without a camera. */
async function samplePhoto(emoji: string, label: string): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 480
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 640, 480)
  grad.addColorStop(0, '#ffb3d9')
  grad.addColorStop(1, '#4fc3f7')
  g.fillStyle = grad
  g.fillRect(0, 0, 640, 480)
  g.textAlign = 'center'
  g.font = '200px sans-serif'
  g.fillText(emoji, 320, 290)
  g.font = 'bold 36px sans-serif'
  g.fillStyle = '#fff'
  g.fillText(label, 320, 420)
  return await new Promise((resolve) => c.toBlob((b) => resolve(b!), 'image/jpeg', 0.8))
}

function pick<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)]
}

/** Parent-only test panel: play every animation and simulate what Maya would do. */
export function DevMode() {
  const { data, actions, backend } = useStore()
  const [party, setParty] = useState(false)
  const [floating, setFloating] = useState<{ id: string; text: string } | null>(null)
  const [msg, setMsg] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [testSpin, setTestSpin] = useState(false)
  const kid = data.settings.kidName

  const done = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg((m) => (m === text ? '' : m)), 4000)
  }

  const run = (label: string, fn: () => Promise<unknown>) => async () => {
    try {
      await fn()
      done(`✓ ${label}`)
    } catch (e) {
      done(`✗ ${(e as Error).message}`)
    }
  }

  const todays = choresForDay(data.chores)
  const anyChore = () => pick(todays) ?? pick(data.chores.filter((c) => c.type === 'chore'))
  const anyBonus = () => pick(data.chores.filter((c) => c.type === 'bonus' && c.active))

  return (
    <section className="card dev-mode">
      <h3>🛠️ Dev mode</h3>
      <p className="muted">
        Test animations and features. Simulated actions create real test entries that also show up on {kid}'s device, so
        use "Clear all activity" when you're done.
      </p>

      <div className="cat-label">Animations & sounds</div>
      <div className="dev-grid">
        <button type="button" className="btn" onClick={() => smallWin()}>
          🎉 Small win
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            bigWin()
            setParty(true)
          }}
        >
          🏆 Big prize celebration
        </button>
        <button type="button" className="btn" onClick={() => setFloating({ id: uid(), text: `+${15 + Math.floor(Math.random() * 20)} ⭐` })}>
          ⭐ Floating stars
        </button>
      </div>

      <div className="cat-label">Sound board</div>
      <div className="dev-grid">
        {(Object.keys(sounds) as Array<keyof typeof sounds>).map((name) => (
          <button type="button" key={name} className="btn tiny" onClick={() => (sounds[name] as () => void)()}>
            🔊 {name}
          </button>
        ))}
      </div>

      <div className="cat-label">Lucky Spin, stickers & feelings</div>
      <div className="dev-grid">
        <button type="button" className="btn" onClick={() => setTestSpin(true)}>
          🎡 Test spin (no stars)
        </button>
        <button
          type="button"
          className="btn"
          onClick={run(`${kid} can spin again today`, async () => {
            if (!spinForDay(data.ledger, dayKey())) throw new Error(`${kid} hasn't spun today yet`)
            await actions.resetSpin()
          })}
        >
          🔄 Reset today's spin
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              const c = anyChore() ?? anyBonus()
              if (!c) throw new Error('No chores in the catalogue')
              const sub = await actions.submitChore(c, undefined, 'Dev mode: sticker test')
              await actions.approveSubmission(sub, pointsFor(sub))
              const st = stickerFor(sub.id)
              sounds.unlock()
              done(`✓ New sticker: ${st.emoji} ${st.name} (${RARITY_LABEL[st.rarity]})`)
            } catch (e) {
              done(`✗ ${(e as Error).message}`)
            }
          }}
        >
          🏷️ Approve a chore → new sticker
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            resetSeenStickers()
            sounds.whoosh()
            done('✓ Stickers on this device will peel again')
          }}
        >
          🎁 Re-wrap stickers (this device)
        </button>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            const m = pick(MOODS) ?? MOODS[3]
            try {
              await actions.checkInMood(m.level, 'Dev mode: test check-in')
              sounds.meow()
              done(`✓ Mood check-in: ${moodInfo(m.level).emoji} ${m.label}`)
            } catch (e) {
              done(`✗ ${(e as Error).message}`)
            }
          }}
        >
          😊 Mood check-in
        </button>
      </div>

      <div className="cat-label">Pretend to be {kid}</div>
      <div className="dev-grid">
        <button
          type="button"
          className="btn"
          onClick={run('Chore sent to Inbox', async () => {
            const c = anyChore()
            if (!c) throw new Error('No chores in the catalogue')
            await actions.submitChore(c)
          })}
        >
          ✅ Finish a chore
        </button>
        <button
          type="button"
          className="btn"
          onClick={run('Chore with photo sent to Inbox', async () => {
            const c = anyChore()
            if (!c) throw new Error('No chores in the catalogue')
            await actions.submitChore(c, await samplePhoto(c.emoji, 'Test photo'), 'I did it with a picture!')
          })}
        >
          📸 Chore + photo
        </button>
        <button
          type="button"
          className="btn"
          onClick={run('Bonus quest sent to Inbox', async () => {
            const c = anyBonus()
            if (!c) throw new Error('No bonus quests are switched on')
            await actions.submitChore(c)
          })}
        >
          🚀 Bonus quest
        </button>
        <button
          type="button"
          className="btn"
          onClick={run('School work sent to Inbox', async () => {
            await actions.submitHomework('Spelling test 100%!', await samplePhoto('🧠', 'A+ Spelling'), 'Test entry')
          })}
        >
          🧠 School star
        </button>
        <button
          type="button"
          className="btn"
          onClick={run('Wish sent to Inbox', async () => {
            await actions.submitWish({ title: 'Test wish: kitty backpack', price: 18, note: 'Test entry', link: 'https://example.com' })
          })}
        >
          💭 Send a wish
        </button>
        <button
          type="button"
          className="btn"
          onClick={run('Prize bought', async () => {
            const prize = data.prizes.filter((p) => p.active).sort((a, b) => a.points - b.points)[0]
            if (!prize) throw new Error('No prizes in the shop')
            if (data.balance < prize.points) await actions.adjustPoints(prize.points - data.balance, 'Dev mode: stars for testing')
            await actions.buyPrize(prize)
          })}
        >
          🎁 Buy a prize
        </button>
      </div>

      <div className="cat-label">Stars</div>
      <div className="dev-grid">
        <button type="button" className="btn" onClick={run('+100 stars', () => actions.adjustPoints(100, 'Dev mode: test stars'))}>
          ➕ 100 stars
        </button>
        <button type="button" className="btn" onClick={run('+1000 stars', () => actions.adjustPoints(1000, 'Dev mode: test stars'))}>
          ➕ 1000 stars
        </button>
        <button
          type="button"
          className="btn"
          onClick={run('Love note sent', () => actions.addNote(`Test note: we love you, ${kid}! 💖`, 'Dev mode'))}
        >
          💌 Love note
        </button>
        <button
          type="button"
          className={confirmClear ? 'btn danger' : 'btn'}
          onClick={async () => {
            if (!confirmClear) {
              setConfirmClear(true)
              setTimeout(() => setConfirmClear(false), 4000)
              return
            }
            setConfirmClear(false)
            const ids = [...data.submissions, ...data.orders, ...data.wishes, ...data.ledger, ...data.moods].map((i) => i.id)
            await run(`Cleared ${ids.length} entries. Stars are back to 0.`, async () => {
              for (const id of ids) await actions.remove(id)
            })()
          }}
        >
          {confirmClear ? '⚠️ Tap again to clear' : '🧹 Clear all activity'}
        </button>
      </div>
      <p className="muted small">
        Clearing removes every chore submission, prize purchase, wish, star entry, Lucky Spin and mood check-in ({backend.mode === 'demo' ? 'demo data' : 'for the whole family'}). Chores,
        prizes, the schedule and love notes stay.
      </p>
      {msg && <p className="dev-msg">{msg}</p>}

      <BigCelebration
        show={party}
        emoji="🐟"
        title={`YOU DID IT, ${kid.toUpperCase()}!`}
        subtitle="This is a test of the prize celebration. Tap anywhere to close."
        onDone={() => setParty(false)}
      />
      {floating && <FloatingPoints key={floating.id} text={floating.text} onDone={() => setFloating(null)} />}
      <LuckySpinOverlay open={testSpin} preview onClose={() => setTestSpin(false)} />
    </section>
  )
}
