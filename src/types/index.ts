export interface Point {
  x: number
  y: number
}

// 每行的掩码存储格式：0 表示无掩码，或 [startCol, endCol] 区间数组
export type RowMask = 0 | [number, number][]

// 掩码边界框
export interface MaskBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface Mask {
  id: string
  name: string
  // 新格式：按行存储的区间计数法
  rows: RowMask[]
  // 边界框，用于快速命中测试
  bounds: MaskBounds
  fillColor: string | null
  visible: boolean
  createdAtScale: number  // 创建时的缩放比例
  // 缓存：像素数量（延迟计算）
  pixelCount?: number
}

// 兼容旧格式的 Mask 数据（导入时使用）
export interface LegacyMask {
  id: string
  name: string
  pixels: number[]  // 旧格式：扁平像素索引数组
  fillColor: string | null
  visible: boolean
  createdAtScale: number
}

export type Mode = 'segment' | 'fill'

export interface AppState {
  mode: Mode
  image: ImageData | null
  imageSize: { width: number; height: number }
  scale: number
  offset: Point
  masks: Map<string, Mask>
  activeMaskId: string | null
  threshold: number
}

export interface PaletteColor {
  name: string
  value: string
}

export interface PaletteGroup {
  name: string
  colors: PaletteColor[]
}
