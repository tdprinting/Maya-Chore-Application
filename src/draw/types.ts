export type ToolId =
  | 'pen'
  | 'marker'
  | 'crayon'
  | 'rainbow'
  | 'glitter'
  | 'spray'
  | 'eraser'
  | 'fill'
  | 'shape'
  | 'sticker'
  | 'text'

export type BgId = 'white' | 'paper' | 'sky' | 'grid' | 'lines' | 'dark'

export type TemplateId = 'cat' | 'flower' | 'fish' | 'house'

export type ShapeId = 'heart' | 'star' | 'flower' | 'cat' | 'circle' | 'square' | 'moon' | 'sparkle'

export type Symmetry = 'off' | 'mirror' | 'kaleido'

/** A point in canvas (internal pixel) space with a pressure multiplier. */
export type Pt = { x: number; y: number; p: number }

export type EngineSettings = {
  tool: ToolId
  color: string
  size: number
  opacity: number
  shape: ShapeId
  sticker: string
  symmetry: Symmetry
}

export type EngineState = {
  canUndo: boolean
  canRedo: boolean
  template: TemplateId | null
}
