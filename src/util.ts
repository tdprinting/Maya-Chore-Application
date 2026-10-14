/** Shrink a camera photo to a reasonable size before uploading. */
export async function compressImage(file: Blob, maxDim = 1280, quality = 0.75): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Could not read that picture'))
      i.src = url
    })
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save that picture'))), 'image/jpeg', quality),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`ohana-stars:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function money(n?: number): string {
  return n ? `$${n.toFixed(2).replace(/\.00$/, '')}` : ''
}

export function safeUrl(link?: string): string | undefined {
  if (!link) return undefined
  try {
    const u = new URL(link.includes('://') ? link : `https://${link}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

/** Show the number of things waiting on the home screen icon (installed iOS/Android apps). */
export function setBadge(n: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  try {
    if (n > 0) void nav.setAppBadge?.(n)
    else void nav.clearAppBadge?.()
  } catch {
    /* not supported */
  }
}
