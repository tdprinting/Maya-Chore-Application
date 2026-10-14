import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Photo } from './components'
import { sounds } from './fx'
import { useStore } from './store'
import type { ChatMessage } from './types'

const READ_KEY = 'ohana-chat-read'
const NAME_KEY = 'ohana-chat-name'

const STICKERS = ['💖', '😺', '🌺', '⭐', '😂', '🥰', '👍', '🎉', '🙏', '🍕', '🛴', '📚']
const QUICK_KID = ['I finished my chores! ✅', 'I love you! 💖', 'Can we play together? 🎲', 'I need help please 🙋‍♀️', 'Guess what? 🤩']
const QUICK_PARENT = ['So proud of you! 🌟', 'Love you! 💖', 'Dinner time! 🍽️', 'Great job today! 🎉', 'Time to get ready for bed 🌙']

function readStamp(side: string): string {
  try {
    return localStorage.getItem(`${READ_KEY}-${side}`) ?? ''
  } catch {
    return ''
  }
}

function writeStamp(side: string, iso: string) {
  try {
    localStorage.setItem(`${READ_KEY}-${side}`, iso)
  } catch {
    /* ignore */
  }
}

/** Messages from the other side that arrived after this device last opened the chat. */
export function useUnreadCount(side: ChatMessage['from']): number {
  const { data } = useStore()
  const [stamp, setStamp] = useState(() => readStamp(side))
  useEffect(() => {
    const onRead = () => setStamp(readStamp(side))
    window.addEventListener('ohana-chat-read', onRead)
    return () => window.removeEventListener('ohana-chat-read', onRead)
  }, [side])
  return data.messages.filter((m) => m.from !== side && m.createdAt > stamp).length
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return today ? t : `${d.toLocaleDateString([], { weekday: 'short' })} ${t}`
}

export function Chat({ side }: { side: ChatMessage['from'] }) {
  const { data, actions } = useStore()
  const [text, setText] = useState('')
  const [showStickers, setShowStickers] = useState(false)
  const [parentName, setParentName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) || 'Mom'
    } catch {
      return 'Mom'
    }
  })
  const bottom = useRef<HTMLDivElement>(null)
  const kid = data.settings.kidName
  const author = side === 'kid' ? kid : parentName
  const messages = data.messages.slice(-200)
  const last = messages[messages.length - 1]

  // Opening the chat (or a new message while it's open) marks everything read.
  useEffect(() => {
    writeStamp(side, last?.createdAt ?? new Date().toISOString())
    window.dispatchEvent(new Event('ohana-chat-read'))
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [side, last?.id, last?.createdAt])

  const send = async (body: string, sticker?: string) => {
    if (!body.trim() && !sticker) return
    if (sticker) sounds.sparkle()
    else {
      sounds.pop()
      setTimeout(() => sounds.boing(), 60)
    }
    setText('')
    setShowStickers(false)
    try {
      await actions.sendMessage(side, author, body.trim(), sticker)
    } catch {
      // Didn't go through: give the words back so nothing typed is lost.
      if (!sticker) setText((t) => t || body)
    }
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <h2 className="section-title">💬 {side === 'kid' ? 'Chat with Mom & Dad' : `Chat with ${kid}`}</h2>
        {side === 'parent' && (
          <div className="seg chat-name">
            {['Mom', 'Dad'].map((n) => (
              <button
                type="button"
                key={n}
                className={parentName === n ? 'on' : ''}
                onClick={() => {
                  setParentName(n)
                  try {
                    localStorage.setItem(NAME_KEY, n)
                  } catch {
                    /* ignore */
                  }
                }}
              >
                I'm {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="chat-log">
        {!messages.length && (
          <div className="empty">
            <div className="empty-emoji">💌</div>
            <p>{side === 'kid' ? 'Say hi to Mom & Dad!' : `Send ${kid} a message!`}</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const mine = m.from === side
            const prev = messages[i - 1]
            const showName = !prev || prev.author !== m.author
            return (
              <motion.div
                key={m.id}
                className={`chat-row ${mine ? 'mine' : 'theirs'}`}
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                style={{ transformOrigin: mine ? 'bottom right' : 'bottom left' }}
              >
                {showName && !mine && <span className="chat-author">{m.author}</span>}
                {m.photo && <Photo src={m.photo} alt={m.text || 'Drawing'} className="chat-photo" />}
                {m.sticker ? (
                  <motion.span
                    className="chat-sticker"
                    initial={{ scale: 0.3 }}
                    animate={{ scale: [0.3, 1.35, 1], rotate: [0, -14, 12, -6, 0] }}
                    transition={{ duration: 0.8 }}
                  >
                    {m.sticker}
                  </motion.span>
                ) : (
                  m.text && <span className={`bubble-msg ${m.from}`}>{m.text}</span>
                )}
                <span className="chat-time">{timeLabel(m.createdAt)}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={bottom} />
      </div>

      <div className="chat-quick">
        {(side === 'kid' ? QUICK_KID : QUICK_PARENT).map((q) => (
          <motion.button type="button" key={q} className="chip" whileTap={{ scale: 0.9, rotate: -2 }} onClick={() => send(q)}>
            {q}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {showStickers && (
          <motion.div className="sticker-tray" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {STICKERS.map((s, i) => (
              <motion.button
                type="button"
                key={s}
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 14, delay: i * 0.025 }}
                whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
                whileTap={{ scale: 1.4 }}
                onClick={() => send('', s)}
              >
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        <motion.button
          type="button"
          className="btn ghost sticker-btn"
          onClick={() => {
            sounds.blip()
            setShowStickers((v) => !v)
          }}
          aria-label="Stickers"
          animate={{ rotate: showStickers ? [0, -15, 12, 0] : 0, scale: showStickers ? 1.12 : 1 }}
          transition={{ duration: 0.45 }}
          whileTap={{ scale: 0.8 }}
        >
          😺
        </motion.button>
        <input className="input" value={text} placeholder="Type a message…" onChange={(e) => setText(e.target.value)} maxLength={500} />
        <motion.button type="submit" className="btn go" whileTap={{ scale: 0.85 }} disabled={!text.trim()}>
          Send
        </motion.button>
      </form>
    </div>
  )
}
