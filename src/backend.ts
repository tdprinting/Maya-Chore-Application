import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { seedItems } from './seed'
import type { Item, Role } from './types'

export interface Membership {
  familyId: string
  role: Role
}

export type Change = { type: 'put'; item: Item } | { type: 'remove'; id: string }

/**
 * Where the family's data lives. The demo backend keeps everything in this browser;
 * the Supabase backend syncs every device in the family in real time.
 */
export interface Backend {
  readonly mode: 'demo' | 'supabase'
  /** The family this device has joined, if any. */
  membership(): Promise<Membership | null>
  createFamily(name: string): Promise<Membership>
  joinFamily(code: string): Promise<Membership>
  leaveFamily(): Promise<void>
  familyCodes(): Promise<{ parentCode: string; kidCode: string } | null>
  load(): Promise<Item[]>
  subscribe(onChange: (c: Change) => void): () => void
  put(item: Item): Promise<void>
  remove(id: string): Promise<void>
  uploadPhoto(blob: Blob): Promise<string>
  photoUrl(ref: string): Promise<string>
}

// ---------------------------------------------------------------------------
// Demo backend: one device, every tab stays in sync. Lets the family try the app
// before setting up Supabase.

const DEMO_ITEMS = 'ohana-demo-items'
const DEMO_MEMBERSHIP = 'ohana-demo-membership'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    console.warn('Could not save', key, e)
  }
}

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const
  private channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ohana-demo') : null
  private items: Record<string, Item>

  constructor() {
    this.items = JSON.parse(safeGet(DEMO_ITEMS) || '{}')
  }

  async membership() {
    const raw = safeGet(DEMO_MEMBERSHIP)
    return raw ? (JSON.parse(raw) as Membership) : null
  }

  async createFamily(): Promise<Membership> {
    if (!Object.keys(this.items).length) {
      for (const item of seedItems()) this.items[item.id] = item
      this.persist()
    }
    const m: Membership = { familyId: 'demo', role: 'parent' }
    safeSet(DEMO_MEMBERSHIP, JSON.stringify(m))
    return m
  }

  async joinFamily(code: string): Promise<Membership> {
    const role: Role = code.trim().toUpperCase().startsWith('PARENT') ? 'parent' : 'kid'
    await this.createFamily()
    const m: Membership = { familyId: 'demo', role }
    safeSet(DEMO_MEMBERSHIP, JSON.stringify(m))
    return m
  }

  async leaveFamily() {
    try {
      localStorage.removeItem(DEMO_MEMBERSHIP)
    } catch {
      /* ignore */
    }
  }

  async familyCodes() {
    return { parentCode: 'PARENT-DEMO', kidCode: 'KID-DEMO' }
  }

  async load() {
    this.items = JSON.parse(safeGet(DEMO_ITEMS) || '{}')
    return Object.values(this.items)
  }

  subscribe(onChange: (c: Change) => void) {
    const handler = (e: MessageEvent<Change>) => {
      const c = e.data
      if (c.type === 'put') this.items[c.item.id] = c.item
      else delete this.items[c.id]
      onChange(c)
    }
    this.channel?.addEventListener('message', handler)
    return () => this.channel?.removeEventListener('message', handler)
  }

  async put(item: Item) {
    this.items[item.id] = item
    this.persist()
    this.channel?.postMessage({ type: 'put', item } satisfies Change)
  }

  async remove(id: string) {
    delete this.items[id]
    this.persist()
    this.channel?.postMessage({ type: 'remove', id } satisfies Change)
  }

  async uploadPhoto(blob: Blob) {
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
  }

  async photoUrl(ref: string) {
    return ref
  }

  private persist() {
    safeSet(DEMO_ITEMS, JSON.stringify(this.items))
  }
}

// ---------------------------------------------------------------------------
// Supabase backend: parents' iPhones and Maya's iPad share one family.

interface ItemRow {
  id: string
  family_id: string
  kind: string
  data: Item
}

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const
  private sb: SupabaseClient
  private member: Membership | null = null
  private urlCache = new Map<string, { url: string; expires: number }>()

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  }

  private async ensureSignedIn() {
    const { data } = await this.sb.auth.getSession()
    if (data.session) return data.session.user.id
    const { data: signed, error } = await this.sb.auth.signInAnonymously()
    if (error || !signed.user) {
      throw new Error(
        `Could not sign in (${error?.message ?? 'unknown error'}). Check that Anonymous sign-ins are turned on in Supabase.`,
      )
    }
    return signed.user.id
  }

  async membership() {
    if (this.member) return this.member
    const { data: sess } = await this.sb.auth.getSession()
    if (!sess.session) return null
    const { data, error } = await this.sb
      .from('members')
      .select('family_id, role')
      .eq('user_id', sess.session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error
    if (!data?.length) return null
    this.member = { familyId: data[0].family_id, role: data[0].role }
    return this.member
  }

  async createFamily(name: string) {
    await this.ensureSignedIn()
    const { data, error } = await this.sb.rpc('create_family', { family_name: name })
    if (error) throw error
    this.member = { familyId: data.family_id, role: data.role }
    const rows = seedItems().map((item) => this.toRow(item))
    const { error: seedErr } = await this.sb.from('items').upsert(rows)
    if (seedErr) throw seedErr
    return this.member
  }

  async joinFamily(code: string) {
    await this.ensureSignedIn()
    const { data, error } = await this.sb.rpc('join_family', { code })
    if (error) throw new Error(error.message)
    this.member = { familyId: data.family_id, role: data.role }
    return this.member
  }

  async leaveFamily() {
    this.member = null
    this.urlCache.clear()
    await this.sb.auth.signOut()
  }

  async familyCodes() {
    const m = await this.membership()
    if (!m || m.role !== 'parent') return null
    const { data, error } = await this.sb.rpc('family_codes', { fid: m.familyId })
    if (error) throw error
    return { parentCode: data.parent_code as string, kidCode: data.kid_code as string }
  }

  async load() {
    const m = this.requireMember()
    const all: Item[] = []
    const page = 1000
    for (let from = 0; ; from += page) {
      const { data, error } = await this.sb
        .from('items')
        .select('data')
        .eq('family_id', m.familyId)
        // Pages are only stable with a fixed order; without one rows can be skipped or repeated.
        .order('id')
        .range(from, from + page - 1)
      if (error) throw error
      all.push(...(data as Array<{ data: Item }>).map((r) => r.data))
      if (!data || data.length < page) break
    }
    return all
  }

  subscribe(onChange: (c: Change) => void) {
    const m = this.requireMember()
    const familyId = m.familyId
    // Supabase can't filter DELETE events (the old row only carries its primary key), so they are
    // heard unfiltered. Item ids are random UUIDs, so a delete from another family matches nothing here.
    const channel = this.sb
      .channel(`family-${familyId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'items', filter: `family_id=eq.${familyId}` },
        (payload) => {
          const row = payload.new as Partial<ItemRow>
          if (row.data) onChange({ type: 'put', item: row.data })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'items', filter: `family_id=eq.${familyId}` },
        (payload) => {
          const row = payload.new as Partial<ItemRow>
          if (row.data) onChange({ type: 'put', item: row.data })
        },
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, (payload) => {
        const old = payload.old as Partial<ItemRow>
        if (!old.id) return
        if (old.family_id && old.family_id !== familyId) return
        // The settings row is stored as `settings:<familyId>`, but the app knows it as `settings`.
        if (old.id.startsWith('settings:')) {
          if (old.id === this.rowId('settings')) onChange({ type: 'remove', id: 'settings' })
          return
        }
        onChange({ type: 'remove', id: old.id })
      })
      .subscribe()
    return () => {
      void this.sb.removeChannel(channel)
    }
  }

  async put(item: Item) {
    const { error } = await this.sb.from('items').upsert({ ...this.toRow(item), updated_at: new Date().toISOString() })
    if (error) throw error
  }

  async remove(id: string) {
    const { error } = await this.sb.from('items').delete().eq('id', this.rowId(id))
    if (error) throw error
  }

  async uploadPhoto(blob: Blob) {
    const m = this.requireMember()
    const type = blob.type || 'image/jpeg'
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${m.familyId}/${crypto.randomUUID()}.${ext}`
    const { error } = await this.sb.storage.from('photos').upload(path, blob, { contentType: type })
    if (error) throw error
    return `sb:${path}`
  }

  async photoUrl(ref: string) {
    if (!ref.startsWith('sb:')) return ref
    const cached = this.urlCache.get(ref)
    if (cached && cached.expires > Date.now()) return cached.url
    const { data, error } = await this.sb.storage.from('photos').createSignedUrl(ref.slice(3), 60 * 60)
    if (error) throw error
    this.urlCache.set(ref, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 })
    return data.signedUrl
  }

  private requireMember() {
    if (!this.member) throw new Error('Not in a family yet')
    return this.member
  }

  /** The settings item has a fixed id, so scope it to the family in the database. */
  private rowId(id: string) {
    return id === 'settings' ? `settings:${this.requireMember().familyId}` : id
  }

  private toRow(item: Item) {
    const m = this.requireMember()
    return { id: this.rowId(item.id), family_id: m.familyId, kind: item.kind, data: item }
  }
}

export function createBackend(): Backend {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && key) return new SupabaseBackend(url, key)
  return new DemoBackend()
}
