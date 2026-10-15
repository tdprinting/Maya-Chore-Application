import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createBackend, type Backend, type Membership } from './backend'
import { Mascot, Modal } from './components'
import { setSoundOn, sounds } from './fx'
import { KidApp } from './kid/KidApp'
import { ParentApp } from './parent/ParentApp'
import { StoreProvider, useStore } from './store'
import { hashPin } from './util'

export default function App() {
  const backend = useMemo(() => createBackend(), [])
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    backend
      .membership()
      .then(setMembership)
      .catch((e: Error) => {
        setError(e.message)
        setMembership(null)
      })
  }, [backend])

  if (membership === undefined) return <Loading />
  if (!membership) return <Welcome backend={backend} onJoined={setMembership} initialError={error} />
  return (
    <StoreProvider backend={backend} membership={membership}>
      <Shell />
    </StoreProvider>
  )
}

function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="center-screen theme-kitty">
      <Mascot size={160} />
      <p className="loading-text">{text}</p>
    </div>
  )
}

function Shell() {
  const { membership, data, ready, error, backend } = useStore()
  const [view, setView] = useState<'kid' | 'parent'>(membership.role)
  const [askPin, setAskPin] = useState(false)

  useEffect(() => setSoundOn(data.settings.sounds), [data.settings.sounds])

  if (error) {
    return (
      <div className="center-screen theme-kitty">
        <Mascot size={120} mood="wow" />
        <p className="error">Something went wrong: {error}</p>
        <button type="button" className="btn" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    )
  }
  if (!ready) return <Loading text={`Getting ${data.settings.kidName}'s stars…`} />

  if (view === 'parent') {
    return <ParentApp canLeaveToKid={membership.role === 'kid'} onKidView={() => setView('kid')} />
  }
  const needsPin = membership.role === 'kid'
  return (
    <>
      <KidApp onGrownUps={() => (needsPin ? setAskPin(true) : setView('parent'))} />
      <PinGate
        open={askPin}
        pinHash={data.settings.parentPinHash}
        allowWithoutPin={backend.mode === 'demo'}
        onClose={() => setAskPin(false)}
        onUnlock={() => {
          setAskPin(false)
          setView('parent')
        }}
      />
    </>
  )
}

function PinGate({ open, pinHash, allowWithoutPin, onClose, onUnlock }: { open: boolean; pinHash?: string; allowWithoutPin: boolean; onClose: () => void; onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)
  useEffect(() => {
    setPin('')
    setWrong(false)
  }, [open])
  const press = async (d: string) => {
    const next = (pin + d).slice(0, 8)
    setPin(next)
    setWrong(false)
    if (pinHash && next.length >= 4 && (await hashPin(next)) === pinHash) onUnlock()
  }
  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-emoji">🔒</div>
      <h2>Grown-ups only</h2>
      {!pinHash ? (
        allowWithoutPin ? (
          <>
            <p className="muted">No parent PIN set yet (demo mode).</p>
            <button type="button" className="btn big go" onClick={onUnlock}>
              Open Parent Hub
            </button>
          </>
        ) : (
          <p className="muted">Set a parent PIN on a parent phone (Family tab, Settings) to open the Parent Hub here.</p>
        )
      ) : (
        <>
          <motion.div className="pin-dots" animate={wrong ? { x: [0, -12, 12, -8, 8, 0] } : {}}>
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span key={i} className={i < pin.length ? 'dot on' : 'dot'} />
            ))}
          </motion.div>
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) =>
              k === '' ? (
                <span key="blank" />
              ) : (
                <button
                  type="button"
                  key={k}
                  className="key"
                  onClick={() => {
                    sounds.pop()
                    if (k === '⌫') setPin(pin.slice(0, -1))
                    else void press(k)
                  }}
                >
                  {k}
                </button>
              ),
            )}
          </div>
          {pin.length >= 4 && (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                if ((await hashPin(pin)) === pinHash) onUnlock()
                else {
                  setWrong(true)
                  setPin('')
                }
              }}
            >
              Enter
            </button>
          )}
        </>
      )}
    </Modal>
  )
}

function Welcome({ backend, onJoined, initialError }: { backend: Backend; onJoined: (m: Membership) => void; initialError?: string }) {
  const [step, setStep] = useState<'start' | 'create' | 'join'>('start')
  const [name, setName] = useState('Our Family')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError ?? '')
  const demo = backend.mode === 'demo'

  const run = async (fn: () => Promise<Membership>) => {
    setBusy(true)
    setError('')
    try {
      onJoined(await fn())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen welcome theme-kitty">
      <div className="bg-bubbles" aria-hidden>
        {['🌺', '⭐', '🎀', '🐠', '🌊', '💖'].map((e, i) => (
          <span key={i} style={{ left: `${i * 17}%`, animationDelay: `${i * 1.3}s` }}>
            {e}
          </span>
        ))}
      </div>
      <Mascot size={170} mood="wink" />
      <motion.h1 className="welcome-title" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        Ohana Stars
      </motion.h1>
      <p className="welcome-sub">Chores, bonus quests and prizes for Maya and her family 🌺</p>

      {demo && step === 'start' && (
        <div className="card welcome-card">
          <p className="warn">
            Demo mode: everything stays on this device. Open a second tab to see the kid and parent apps talk to each other.
          </p>
          <div className="row">
            <button type="button" className="btn big go grow" disabled={busy} onClick={() => run(() => backend.joinFamily('KID-DEMO'))}>
              🎀 Try as Maya
            </button>
            <button type="button" className="btn big grow" disabled={busy} onClick={() => run(() => backend.joinFamily('PARENT-DEMO'))}>
              👩‍👧 Try as a parent
            </button>
          </div>
        </div>
      )}

      {!demo && step === 'start' && (
        <div className="card welcome-card">
          <button type="button" className="btn big go" onClick={() => setStep('create')}>
            👩‍👧 I'm a parent: set up our family
          </button>
          <button type="button" className="btn big" onClick={() => setStep('join')}>
            🔑 I have a family code
          </button>
        </div>
      )}

      {step === 'create' && (
        <div className="card welcome-card">
          <label className="field">
            Family name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="button" className="btn big go" disabled={busy} onClick={() => run(() => backend.createFamily(name))}>
            {busy ? 'Setting up…' : 'Create our family ✨'}
          </button>
          <button type="button" className="btn ghost" onClick={() => setStep('start')}>
            Back
          </button>
        </div>
      )}

      {step === 'join' && (
        <div className="card welcome-card">
          <label className="field">
            Family code (from a parent's Family tab)
            <input className="input code-input" value={code} placeholder="KID-XXXXXX" autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <button type="button" className="btn big go" disabled={busy || code.trim().length < 5} onClick={() => run(() => backend.joinFamily(code))}>
            {busy ? 'Joining…' : 'Join 🚀'}
          </button>
          <button type="button" className="btn ghost" onClick={() => setStep('start')}>
            Back
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <p className="muted small">Tip: on iPad or iPhone, tap Share, then “Add to Home Screen” to install the app.</p>
    </div>
  )
}
