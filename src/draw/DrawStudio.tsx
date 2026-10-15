import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import './draw.css'
import { sounds } from '../fx'
import { DrawEngine } from './engine'
import { BACKGROUNDS, paintBackground, toPt } from './brushes'
import { SHAPES, TEMPLATES, drawTemplate, partFill } from './shapes'
import { COLOR_TOOLS, PALETTE, STICKERS, TOOLS } from './data'
import {
  GALLERY_MAX,
  getGallery,
  loadDraft,
  loadPrefs,
  saveDraft,
  savePrefs,
  setGallery,
  type GalleryItem,
} from './storage'
import type { BgId, EngineSettings, Pt, ShapeId, Symmetry, TemplateId, ToolId } from './types'

type Sheet = null | 'bg' | 'pages' | 'gallery' | 'send'
type SendState = 'idle' | 'sending' | 'error'

const SYM_NEXT: Record<Symmetry, Symmetry> = { off: 'mirror', mirror: 'kaleido', kaleido: 'off' }
const SYM_LABEL: Record<Symmetry, string> = { off: 'Mirror', mirror: 'Mirror ↔', kaleido: 'Kaleido' }

function previewURL(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): string {
  try {
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 120
    const ctx = c.getContext('2d')
    if (!ctx) return ''
    draw(ctx, 160, 120)
    return c.toDataURL('image/png')
  } catch {
    return ''
  }
}

export function DrawStudio({
  onSend,
  kidName,
}: {
  onSend: (image: Blob, caption: string) => Promise<void>
  kidName: string
}) {
  const prefs = useMemo(() => loadPrefs(kidName), [kidName])

  const [tool, setTool] = useState<ToolId>(prefs.tool ?? 'pen')
  const [color, setColor] = useState(prefs.color ?? '#ff6fae')
  const [size, setSize] = useState(prefs.size ?? 10)
  const [opacity, setOpacity] = useState(prefs.opacity ?? 1)
  const [shape, setShape] = useState<ShapeId>(prefs.shape ?? 'heart')
  const [sticker, setSticker] = useState(prefs.sticker ?? '🐱')
  const [symmetry, setSymmetry] = useState<Symmetry>(prefs.symmetry ?? 'off')
  const [recent, setRecent] = useState<string[]>(prefs.recent ?? [])
  const [bg, setBg] = useState<BgId>('white')
  const [template, setTemplate] = useState<TemplateId | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [clearArmed, setClearArmed] = useState(false)
  const [textAt, setTextAt] = useState<Pt | null>(null)
  const [textValue, setTextValue] = useState('')
  const [propsOpen, setPropsOpen] = useState(true)
  const [gallery, setGalleryState] = useState<GalleryItem[]>(() => getGallery(kidName))
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [sendState, setSendState] = useState<SendState>('idle')
  const [sendPreview, setSendPreview] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const [stageW, setStageW] = useState(800)

  const stageRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLCanvasElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const lineRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<DrawEngine | null>(null)
  const dirtyRef = useRef(false)
  const saveTimer = useRef<number>(0)
  const lastPenAt = useRef(0)
  const toastTimer = useRef<number>(0)

  const settingsRef = useRef<EngineSettings>({ tool, color, size, opacity, shape, sticker, symmetry })
  settingsRef.current = { tool, color, size, opacity, shape, sticker, symmetry }

  const showToast = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  /* ---------- drafts ---------- */

  const saveNow = useCallback(() => {
    const eng = engineRef.current
    if (!eng || !dirtyRef.current) return
    window.clearTimeout(saveTimer.current)
    try {
      saveDraft(kidName, { img: eng.inkDataURL(), bg: eng.bgId, tpl: eng.tpl }, () => eng.inkDataURL(0.5))
      dirtyRef.current = false
    } catch {
      /* storage unavailable: keep drawing anyway */
    }
  }, [kidName])

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(saveNow, 700)
  }, [saveNow])

  /* ---------- engine setup ---------- */

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage || !bgRef.current || !inkRef.current || !liveRef.current || !lineRef.current) return
    const cssW = stage.getBoundingClientRect().width || 800
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const w = Math.round(Math.max(720, Math.min(1440, cssW * dpr)))
    const h = Math.round((w * 3) / 4)
    const eng = new DrawEngine(
      { bg: bgRef.current, ink: inkRef.current, live: liveRef.current, line: lineRef.current },
      w,
      h,
      () => settingsRef.current,
    )
    engineRef.current = eng
    eng.onState = (s) => {
      setCanUndo(s.canUndo)
      setCanRedo(s.canRedo)
      setTemplate(s.template)
    }
    eng.onCommit = scheduleSave
    eng.onText = (p) => {
      setTextAt(p)
      setTextValue('')
    }
    const draft = loadDraft(kidName)
    if (draft) {
      setBg(draft.bg)
      eng.loadInk(draft.img, { bg: draft.bg, tpl: draft.tpl }).catch(() => {
        /* corrupt draft: start fresh */
      })
    }
    return () => {
      saveNow()
      if (engineRef.current === eng) engineRef.current = null
    }
    // the engine lives for the whole mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(() => setStageW(stage.getBoundingClientRect().width || 800))
    ro.observe(stage)
    // iOS: stop long-press magnifier / scrolling from stealing strokes
    const stop = (e: TouchEvent) => e.preventDefault()
    stage.addEventListener('touchstart', stop, { passive: false })
    stage.addEventListener('touchmove', stop, { passive: false })
    const onHide = () => {
      if (document.visibilityState === 'hidden') saveNow()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', saveNow)
    return () => {
      ro.disconnect()
      stage.removeEventListener('touchstart', stop)
      stage.removeEventListener('touchmove', stop)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', saveNow)
    }
  }, [saveNow])

  useEffect(() => {
    savePrefs(kidName, { tool, color, size, opacity, shape, sticker, symmetry, recent })
  }, [kidName, tool, color, size, opacity, shape, sticker, symmetry, recent])

  useEffect(() => {
    if (!clearArmed) return
    const t = window.setTimeout(() => setClearArmed(false), 3000)
    return () => window.clearTimeout(t)
  }, [clearArmed])

  useEffect(() => {
    if (!celebrate) return
    const t = window.setTimeout(() => setCelebrate(false), 4200)
    return () => window.clearTimeout(t)
  }, [celebrate])

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current)
      window.clearTimeout(saveTimer.current)
    },
    [],
  )

  /* ---------- keyboard shortcuts ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- pointer input ---------- */

  const rememberColor = useCallback((c: string) => {
    setRecent((r) => (r[0] === c ? r : [c, ...r.filter((x) => x !== c)].slice(0, 8)))
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const eng = engineRef.current
    const stage = stageRef.current
    if (!eng || !stage) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.pointerType === 'pen') lastPenAt.current = Date.now()
    // simple palm rejection: right after the pencil was used, ignore fingers
    if (e.pointerType === 'touch' && Date.now() - lastPenAt.current < 1200) return
    if (eng.drawing) {
      if (e.pointerType === 'pen' && eng.activePointerType === 'touch') eng.cancelStroke(true)
      else return
    }
    setTextAt(null)
    try {
      stage.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    eng.begin(toPt(e.nativeEvent, stage.getBoundingClientRect(), eng.w, eng.h), e.pointerId, e.pointerType)
    if (tool === 'shape' || tool === 'sticker') sounds.boing()
    else if (tool === 'fill') sounds.whoosh()
    if (COLOR_TOOLS.includes(tool) && tool !== 'text') rememberColor(color)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const eng = engineRef.current
    const stage = stageRef.current
    if (e.pointerType === 'pen') lastPenAt.current = Date.now()
    if (!eng || !stage || !eng.drawing || eng.activePointer !== e.pointerId) return
    const rect = stage.getBoundingClientRect()
    const native = e.nativeEvent
    const list = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    const evs = list.length ? list : [native]
    eng.move(evs.map((ev) => toPt(ev, rect, eng.w, eng.h)))
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const eng = engineRef.current
    if (!eng || eng.activePointer !== e.pointerId) return
    eng.end()
  }

  /* ---------- actions ---------- */

  const undo = () => {
    if (!engineRef.current?.canUndo) return
    sounds.pop()
    engineRef.current.undo()
  }
  const redo = () => {
    if (!engineRef.current?.canRedo) return
    sounds.pop()
    engineRef.current.redo()
  }

  const pickColor = (c: string) => {
    setColor(c)
    if (tool === 'eraser' || tool === 'rainbow' || tool === 'sticker') setTool('pen')
  }

  const chooseBg = (b: BgId) => {
    setBg(b)
    engineRef.current?.setBackground(b)
    setSheet(null)
  }

  const chooseTemplate = (t: TemplateId | null) => {
    engineRef.current?.setTemplate(t)
    setSheet(null)
    if (t) {
      setTool('fill')
      showToast('Tap inside the lines with the paint bucket! 🪣')
    }
  }

  const onClear = () => {
    if (!clearArmed) {
      setClearArmed(true)
      return
    }
    setClearArmed(false)
    sounds.whoosh(true)
    engineRef.current?.clear()
    showToast('Fresh page! (Undo brings it back)')
  }

  const addText = () => {
    if (textAt && textValue.trim()) engineRef.current?.placeText(textAt, textValue)
    setTextAt(null)
    setTextValue('')
  }

  const saveToGallery = useCallback(
    async (quiet = false) => {
      const eng = engineRef.current
      if (!eng) return
      if (eng.isBlank()) {
        if (!quiet) showToast('Draw something first! ✏️')
        return
      }
      try {
        const thumb = eng.flatten(320).toDataURL('image/jpeg', 0.8)
        const ink = await eng.inkBlob()
        const item: GalleryItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          thumb,
          ink,
          bg: eng.bgId,
          tpl: eng.tpl,
          at: Date.now(),
        }
        setGalleryState((g) => {
          const next = [item, ...g].slice(0, GALLERY_MAX)
          setGallery(kidName, next)
          return next
        })
        if (!quiet) showToast('Saved to your gallery! ⭐')
      } catch {
        if (!quiet) showToast('Oops, could not save that one.')
      }
    },
    [kidName, showToast],
  )

  const openGalleryItem = async (item: GalleryItem) => {
    const eng = engineRef.current
    if (!eng) return
    setSheet(null)
    try {
      await eng.loadInk(item.ink, { bg: item.bg, tpl: item.tpl, record: true })
      setBg(item.bg)
      scheduleSave()
    } catch {
      showToast('Oops, could not open that one.')
    }
  }

  const removeGalleryItem = (id: string) => {
    if (deleteArmed !== id) {
      setDeleteArmed(id)
      return
    }
    setDeleteArmed(null)
    setGalleryState((g) => {
      const next = g.filter((x) => x.id !== id)
      setGallery(kidName, next)
      return next
    })
  }

  const newPage = async () => {
    const eng = engineRef.current
    if (!eng) return
    await saveToGallery(true)
    if (eng.tpl) eng.setTemplate(null)
    else eng.clear()
    setSheet(null)
    showToast('New page! Your last one is in the gallery ⭐')
  }

  const openSend = () => {
    const eng = engineRef.current
    if (!eng) return
    if (eng.isBlank()) {
      showToast('Draw something first! ✏️')
      return
    }
    setSendPreview(eng.flatten(640).toDataURL('image/jpeg', 0.85))
    setSendState('idle')
    setSheet('send')
  }

  const doSend = async () => {
    const eng = engineRef.current
    if (!eng || sendState === 'sending') return
    setSendState('sending')
    try {
      const blob = await eng.exportJpeg(1600, 0.9)
      await onSend(blob, caption.trim())
      setSendState('idle')
      setSheet(null)
      setCaption('')
      setCelebrate(true)
      sounds.tada()
      void saveToGallery(true)
    } catch {
      setSendState('error')
    }
  }

  /* ---------- derived UI ---------- */

  const bgPreviews = useMemo(
    () => Object.fromEntries(BACKGROUNDS.map((b) => [b.id, previewURL((ctx, w, h) => paintBackground(ctx, b.id, w, h))])),
    [],
  )
  const tplPreviews = useMemo(
    () =>
      Object.fromEntries(
        TEMPLATES.map((t) => [
          t.id,
          previewURL((ctx, w, h) => {
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, w, h)
            drawTemplate(ctx, t.id, w, h, '#2b2b3a')
          }),
        ]),
      ),
    [],
  )

  const toolInfo = TOOLS.find((t) => t.id === tool) ?? TOOLS[0]
  const scale = stageW / 800
  const isStamp = tool === 'shape' || tool === 'sticker'
  const mult = tool === 'marker' ? 1.7 : tool === 'eraser' ? 1.8 : tool === 'spray' ? 3.2 : 1
  const previewD = isStamp
    ? Math.min(56, Math.max(18, (22 + size * 2.4) * scale))
    : Math.min(56, Math.max(3, size * mult * scale))
  const previewColor = tool === 'rainbow' ? '#ff6fae' : tool === 'eraser' ? '#ffffff' : color

  return (
    <div className="ds-root">
      {/* ---------- top bar ---------- */}
      <header className="ds-top ds-panel">
        <div className="ds-title">
          <span className="ds-title-emoji" aria-hidden>
            🎨
          </span>
          <span className="ds-title-text">{kidName}&rsquo;s Art Studio</span>
        </div>
        <div className="ds-actions">
          <button className="ds-act" onClick={undo} disabled={!canUndo} aria-label="Undo">
            <UndoIcon />
            <span>Undo</span>
          </button>
          <button className="ds-act" onClick={redo} disabled={!canRedo} aria-label="Redo">
            <UndoIcon flip />
            <span>Redo</span>
          </button>
          <button
            className={`ds-act ${symmetry !== 'off' ? 'ds-on' : ''}`}
            onClick={() => setSymmetry(SYM_NEXT[symmetry])}
            aria-label={`Symmetry: ${symmetry}`}
          >
            <span className="ds-act-emoji">{symmetry === 'kaleido' ? '❄️' : '🦋'}</span>
            <span>{SYM_LABEL[symmetry]}</span>
          </button>
          <button className="ds-act" onClick={() => setSheet('bg')}>
            <span className="ds-act-emoji">🖼️</span>
            <span>Paper</span>
          </button>
          <button className={`ds-act ${template ? 'ds-on' : ''}`} onClick={() => setSheet('pages')}>
            <span className="ds-act-emoji">📖</span>
            <span>Color in</span>
          </button>
          <button className="ds-act" onClick={() => setSheet('gallery')}>
            <span className="ds-act-emoji">⭐</span>
            <span>Gallery</span>
          </button>
          <button className={`ds-act ${clearArmed ? 'ds-danger' : ''}`} onClick={onClear}>
            <span className="ds-act-emoji">🗑️</span>
            <span>{clearArmed ? 'Tap again!' : 'Clear'}</span>
          </button>
        </div>
        <button className="ds-send-btn" onClick={openSend}>
          Send to Mom &amp; Dad 💌
        </button>
      </header>

      <div className="ds-layout">
        {/* ---------- tools ---------- */}
        <nav className="ds-tools ds-panel" aria-label="Drawing tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`ds-tool ${tool === t.id ? 'ds-selected' : ''}`}
              onClick={() => {
                if (tool !== t.id) sounds.blip()
                setTool(t.id)
                setTextAt(null)
              }}
              aria-pressed={tool === t.id}
            >
              <span className="ds-tool-emoji" aria-hidden>
                {t.emoji}
              </span>
              <span className="ds-tool-label">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* ---------- canvas ---------- */}
        <div className="ds-canvas-col">
          <div
            ref={stageRef}
            className={`ds-stage ds-cursor-${tool}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas ref={bgRef} className="ds-layer" />
            <canvas ref={inkRef} className="ds-layer" />
            <canvas ref={liveRef} className="ds-layer" />
            <canvas ref={lineRef} className="ds-layer" />
            {symmetry !== 'off' && <div className="ds-guide ds-guide-v" />}
            {symmetry === 'kaleido' && <div className="ds-guide ds-guide-h" />}
            {textAt && engineRef.current && (
              <div
                className="ds-text-pin"
                style={{
                  left: `${(textAt.x / engineRef.current.w) * 100}%`,
                  top: `${(textAt.y / engineRef.current.h) * 100}%`,
                }}
              />
            )}
          </div>

          <AnimatePresence>
            {textAt && (
              <motion.div
                className="ds-textbar ds-panel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <input
                  className="ds-input"
                  autoFocus
                  value={textValue}
                  maxLength={60}
                  placeholder="Type your words…"
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addText()
                    if (e.key === 'Escape') setTextAt(null)
                  }}
                />
                <button className="ds-pill ds-pill-pink" onClick={addText} disabled={!textValue.trim()}>
                  Add ✓
                </button>
                <button className="ds-pill" onClick={() => setTextAt(null)} aria-label="Cancel">
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="ds-sub">
            {tool === 'shape' ? (
              <div className="ds-chips" role="listbox" aria-label="Shapes">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    className={`ds-chip ${shape === s.id ? 'ds-selected' : ''}`}
                    onClick={() => setShape(s.id)}
                    aria-label={s.label}
                    aria-selected={shape === s.id}
                  >
                    <svg viewBox="0 0 100 100" width="30" height="30" aria-hidden>
                      {s.parts.map((p, i) => (
                        <path key={i} d={p.d} fill={partFill(p, color)} stroke={p.fill === 'color' && color === '#ffffff' ? '#c9d2e6' : 'none'} strokeWidth="4" />
                      ))}
                    </svg>
                  </button>
                ))}
              </div>
            ) : tool === 'sticker' ? (
              <div className="ds-chips" role="listbox" aria-label="Stickers">
                {STICKERS.map((s) => (
                  <button
                    key={s}
                    className={`ds-chip ds-chip-emoji ${sticker === s ? 'ds-selected' : ''}`}
                    onClick={() => setSticker(s)}
                    aria-selected={sticker === s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="ds-hint">
                <span aria-hidden>{toolInfo.emoji}</span> {toolInfo.hint}
              </p>
            )}
          </div>
        </div>

        {/* ---------- brush + colors ---------- */}
        <section className={`ds-props ds-panel ${propsOpen ? '' : 'ds-collapsed'}`} aria-label="Brush and colors">
          <button className="ds-props-toggle" onClick={() => setPropsOpen((o) => !o)} aria-expanded={propsOpen}>
            <span>🎨 Colors &amp; size</span>
            <span className={`ds-caret ${propsOpen ? 'ds-caret-open' : ''}`} aria-hidden>
              ▾
            </span>
          </button>

          <div className="ds-sliders">
            <div className="ds-preview" aria-hidden>
              {tool === 'sticker' ? (
                <span style={{ fontSize: previewD * 0.8, lineHeight: 1, opacity }}>{sticker}</span>
              ) : tool === 'shape' ? (
                <svg viewBox="0 0 100 100" width={previewD} height={previewD} style={{ opacity }}>
                  {(SHAPES.find((s) => s.id === shape) ?? SHAPES[0]).parts.map((p, i) => (
                    <path key={i} d={p.d} fill={partFill(p, color)} />
                  ))}
                </svg>
              ) : (
                <span
                  className={`ds-dot ${tool === 'eraser' ? 'ds-dot-eraser' : ''}`}
                  style={{
                    width: previewD,
                    height: previewD,
                    background: previewColor,
                    opacity: tool === 'marker' ? opacity * 0.55 : tool === 'eraser' ? 1 : opacity,
                  }}
                />
              )}
            </div>
            <label className="ds-slider">
              <span>Size</span>
              <input type="range" min={2} max={60} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </label>
            <label className="ds-slider">
              <span>See-through</span>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                disabled={tool === 'eraser'}
              />
            </label>
          </div>

          <div className="ds-palette" role="listbox" aria-label="Colors">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`ds-swatch ${color === c ? 'ds-selected' : ''} ${c === '#ffffff' ? 'ds-swatch-white' : ''}`}
                style={{ background: c }}
                onClick={() => pickColor(c)}
                aria-label={`Color ${c}`}
                aria-selected={color === c}
              />
            ))}
          </div>

          <div className="ds-extra">
            <label className="ds-custom" title="Make your own color">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#ff6fae'} onChange={(e) => pickColor(e.target.value)} />
              <span>Mix</span>
            </label>
            {recent.length > 0 && (
              <div className="ds-recent" aria-label="Recent colors">
                <span className="ds-recent-label">Recent</span>
                {recent.map((c) => (
                  <button
                    key={c}
                    className={`ds-swatch ds-swatch-sm ${color === c ? 'ds-selected' : ''} ${c === '#ffffff' ? 'ds-swatch-white' : ''}`}
                    style={{ background: c }}
                    onClick={() => pickColor(c)}
                    aria-label={`Recent color ${c}`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {createPortal(
        <div className="ds-portal">
      {/* ---------- sheets ---------- */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            className="ds-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => sendState !== 'sending' && setSheet(null)}
          >
            <motion.div
              className="ds-sheet ds-panel"
              role="dialog"
              aria-modal="true"
              initial={{ y: 40, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 40, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="ds-close"
                onClick={() => setSheet(null)}
                aria-label="Close"
                disabled={sendState === 'sending'}
              >
                ✕
              </button>

              {sheet === 'bg' && (
                <>
                  <h3 className="ds-sheet-title">Pick your paper</h3>
                  <div className="ds-grid">
                    {BACKGROUNDS.map((b) => (
                      <button key={b.id} className={`ds-card ${bg === b.id ? 'ds-selected' : ''}`} onClick={() => chooseBg(b.id)}>
                        <img src={bgPreviews[b.id]} alt="" />
                        <span>{b.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {sheet === 'pages' && (
                <>
                  <h3 className="ds-sheet-title">Coloring pages</h3>
                  <p className="ds-sheet-sub">Starts a fresh page. Oops? Undo brings your drawing back.</p>
                  <div className="ds-grid">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        className={`ds-card ${template === t.id ? 'ds-selected' : ''}`}
                        onClick={() => chooseTemplate(t.id)}
                      >
                        <img src={tplPreviews[t.id]} alt="" />
                        <span>
                          {t.emoji} {t.label}
                        </span>
                      </button>
                    ))}
                    {template && (
                      <button className="ds-card ds-card-plain" onClick={() => chooseTemplate(null)}>
                        <span className="ds-card-big">📄</span>
                        <span>No outline</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {sheet === 'gallery' && (
                <>
                  <h3 className="ds-sheet-title">My gallery</h3>
                  <div className="ds-gallery-actions">
                    <button className="ds-pill ds-pill-yellow" onClick={() => void saveToGallery()}>
                      ⭐ Save this drawing
                    </button>
                    <button className="ds-pill ds-pill-mint" onClick={() => void newPage()}>
                      ✨ New page
                    </button>
                  </div>
                  {gallery.length === 0 ? (
                    <p className="ds-sheet-sub">No saved drawings yet. Tap “Save this drawing” to keep one here!</p>
                  ) : (
                    <div className="ds-grid">
                      {gallery.map((g) => (
                        <div key={g.id} className="ds-card ds-card-gallery">
                          <button className="ds-card-open" onClick={() => void openGalleryItem(g)} aria-label="Open drawing">
                            <img src={g.thumb} alt="Saved drawing" />
                          </button>
                          <button
                            className={`ds-card-del ${deleteArmed === g.id ? 'ds-danger' : ''}`}
                            onClick={() => removeGalleryItem(g.id)}
                          >
                            {deleteArmed === g.id ? 'Sure?' : '✕'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="ds-sheet-small">Keeps up to {GALLERY_MAX} drawings while the app is open.</p>
                </>
              )}

              {sheet === 'send' && (
                <>
                  <h3 className="ds-sheet-title">Send to Mom &amp; Dad 💌</h3>
                  {sendPreview && <img className="ds-send-preview" src={sendPreview} alt="Your drawing" />}
                  <input
                    className="ds-input ds-input-wide"
                    value={caption}
                    maxLength={140}
                    placeholder="Say something about it… (optional)"
                    onChange={(e) => setCaption(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void doSend()}
                  />
                  {sendState === 'error' && <p className="ds-error">Oops! It didn’t send. Try again?</p>}
                  <button className="ds-send-btn ds-send-big" onClick={() => void doSend()} disabled={sendState === 'sending'}>
                    {sendState === 'sending' ? 'Sending…' : 'Send it! 🚀'}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrate && <SentCelebration kidName={kidName} onDone={() => setCelebrate(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="ds-toast"
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ---------- little pieces ---------- */

function UndoIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path
        d="M9 5L4 10l5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.5 10H14a5.5 5.5 0 0 1 0 11h-3" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  )
}

function PaperPlane() {
  return (
    <svg viewBox="0 0 120 100" width="120" height="100" aria-hidden>
      <path d="M4 46L116 6L70 94L54 60Z" fill="#ffffff" stroke="#2f4a8a" strokeWidth="5" strokeLinejoin="round" />
      <path d="M54 60L116 6L44 84Z" fill="#6ec6f0" stroke="#2f4a8a" strokeWidth="5" strokeLinejoin="round" />
      <path d="M54 60L116 6" stroke="#2f4a8a" strokeWidth="5" strokeLinecap="round" />
      <path d="M78 52a7 7 0 0 1 12-6a7 7 0 0 1 12 6c0 8-12 14-12 14s-12-6-12-14Z" fill="#ff6fae" />
    </svg>
  )
}

const HEARTS = [
  { x: -120, d: 0.1, s: 1, c: '#ff6fae' },
  { x: -60, d: 0.35, s: 0.7, c: '#ffd84d' },
  { x: 10, d: 0.2, s: 1.2, c: '#ff6fae' },
  { x: 70, d: 0.45, s: 0.8, c: '#7ee0c3' },
  { x: 130, d: 0.05, s: 1, c: '#6ec6f0' },
  { x: -20, d: 0.6, s: 0.6, c: '#ff6fae' },
]

function SentCelebration({ kidName, onDone }: { kidName: string; onDone: () => void }) {
  return (
    <motion.div
      className="ds-celebrate"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
      role="status"
    >
      <div className="ds-celebrate-stage">
        {HEARTS.map((h, i) => (
          <motion.svg
            key={i}
            className="ds-heart"
            viewBox="0 0 100 100"
            width={44 * h.s}
            height={44 * h.s}
            initial={{ x: h.x, y: 80, opacity: 0, scale: 0.3 }}
            animate={{ y: -260, opacity: [0, 1, 1, 0], scale: [0.3, 1, 1, 0.8], rotate: h.x / 6 }}
            transition={{ duration: 2.4, delay: h.d, ease: 'easeOut' }}
          >
            <path
              d="M50 88C20 66 6 50 6 32C6 18 17 8 30 8C39 8 46 13 50 21C54 13 61 8 70 8C83 8 94 18 94 32C94 50 80 66 50 88Z"
              fill={h.c}
            />
          </motion.svg>
        ))}
        <motion.div
          className="ds-plane"
          initial={{ x: -40, y: 40, rotate: -10, scale: 0.6 }}
          animate={{
            x: [-40, 0, 40, 420],
            y: [40, 0, -10, -420],
            rotate: [-10, 0, -8, -25],
            scale: [0.6, 1.1, 1, 0.7],
          }}
          transition={{ duration: 2.2, times: [0, 0.3, 0.55, 1], ease: 'easeInOut' }}
        >
          <PaperPlane />
        </motion.div>
      </div>
      <motion.div
        className="ds-celebrate-card ds-panel"
        initial={{ y: 30, scale: 0.8, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 18 }}
      >
        <div className="ds-celebrate-title">Sent! 💌</div>
        <div className="ds-celebrate-text">Mom &amp; Dad are going to love it, {kidName}!</div>
        <button className="ds-pill ds-pill-pink" onClick={onDone}>
          Keep drawing ✏️
        </button>
      </motion.div>
    </motion.div>
  )
}
