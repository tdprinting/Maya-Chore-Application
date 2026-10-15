import type { BgId, ShapeId, Symmetry, TemplateId, ToolId } from './types'

export type Draft = { img: string; bg: BgId; tpl: TemplateId | null }

export type Prefs = {
  tool: ToolId
  color: string
  size: number
  opacity: number
  shape: ShapeId
  sticker: string
  symmetry: Symmetry
  recent: string[]
}

export type GalleryItem = {
  id: string
  thumb: string
  ink: Blob
  bg: BgId
  tpl: TemplateId | null
  at: number
}

const key = (kind: string, kid: string) => `ds-${kind}-v1:${kid.toLowerCase()}`

function readJSON<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJSON(k: string, v: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(v))
    return true
  } catch {
    return false
  }
}

export function loadDraft(kid: string): Draft | null {
  const d = readJSON<Draft>(key('draft', kid))
  return d && typeof d.img === 'string' ? d : null
}

/** Save the draft; `fallback` produces a smaller image if the first one doesn't fit. */
export function saveDraft(kid: string, draft: Draft, fallback?: () => string): boolean {
  if (writeJSON(key('draft', kid), draft)) return true
  if (fallback) return writeJSON(key('draft', kid), { ...draft, img: fallback() })
  return false
}

export function clearDraft(kid: string) {
  try {
    localStorage.removeItem(key('draft', kid))
  } catch {
    /* ignore */
  }
}

export function loadPrefs(kid: string): Partial<Prefs> {
  return readJSON<Partial<Prefs>>(key('prefs', kid)) ?? {}
}

export function savePrefs(kid: string, prefs: Prefs) {
  writeJSON(key('prefs', kid), prefs)
}

/* In-session gallery: lives as long as the app is open (survives leaving and re-entering the studio). */
const galleries = new Map<string, GalleryItem[]>()
export const GALLERY_MAX = 8

export function getGallery(kid: string): GalleryItem[] {
  return galleries.get(kid) ?? []
}

export function setGallery(kid: string, items: GalleryItem[]) {
  galleries.set(kid, items.slice(0, GALLERY_MAX))
}
