export interface Point {
  x: number
  y: number
}

export interface Mask {
  id: string
  name: string
  pixels: Set<number>  // 原始图像坐标系下的像素索引
  fillColor: string | null
  visible: boolean
  createdAtScale: number  // 创建时的缩放比例
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
