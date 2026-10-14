import type { ToolId } from './types'

export const PALETTE = [
  '#2b2b3a', '#ffffff', '#9aa3b8', '#a8693f',
  '#ff4f5e', '#ff8a3d', '#ffd84d', '#a6e05a',
  '#3fbf7f', '#7ee0c3', '#6ec6f0', '#3b7be0',
  '#2f4a8a', '#a98bff', '#ff6fae', '#ffc2dc',
]

export const TOOLS: { id: ToolId; label: string; emoji: string; hint: string }[] = [
  { id: 'pen', label: 'Pen', emoji: '🖊️', hint: 'Smooth lines. Press harder with Apple Pencil for thicker lines!' },
  { id: 'marker', label: 'Marker', emoji: '🖌️', hint: 'See-through marker. Layer it to make colors deeper.' },
  { id: 'crayon', label: 'Crayon', emoji: '🖍️', hint: 'Bumpy crayon texture. Tiny sizes look like a pencil.' },
  { id: 'rainbow', label: 'Rainbow', emoji: '🌈', hint: 'Changes color as you draw. Make long swirly lines!' },
  { id: 'glitter', label: 'Glitter', emoji: '✨', hint: 'Sprinkles sparkly stars. Looks amazing on Night paper.' },
  { id: 'spray', label: 'Spray', emoji: '💨', hint: 'Hold still to spray more paint.' },
  { id: 'eraser', label: 'Eraser', emoji: '🧽', hint: 'Rubs out drawing. Coloring page lines stay put.' },
  { id: 'fill', label: 'Fill', emoji: '🪣', hint: 'Tap inside a shape to fill it with color.' },
  { id: 'shape', label: 'Shapes', emoji: '💟', hint: 'Tap to stamp a shape. Drag to make a trail!' },
  { id: 'sticker', label: 'Stickers', emoji: '😻', hint: 'Tap to stick it on. Drag for a sticker parade!' },
  { id: 'text', label: 'Words', emoji: '🔤', hint: 'Tap where you want your words to go.' },
]

export const STICKERS = [
  '🐱', '😺', '🐶', '🐰', '🦄', '🐠', '🐢', '🦋',
  '🌺', '🌸', '🌻', '🌈', '⭐', '🌙', '☀️', '☁️',
  '💖', '🎀', '👑', '🎈', '🍦', '🧁', '🍓', '🍩',
  '🛴', '👽', '🚀', '🏝️',
]

/** Tools that use the chosen color (for "recent colors"). */
export const COLOR_TOOLS: ToolId[] = ['pen', 'marker', 'crayon', 'glitter', 'spray', 'fill', 'shape', 'text']
