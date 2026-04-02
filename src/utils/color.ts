export interface RGB {
  r: number
  g: number
  b: number
}

export function getPixelColor(imageData: ImageData, x: number, y: number): RGB {
  const idx = (y * imageData.width + x) * 4
  return {
    r: imageData.data[idx] ?? 0,
    g: imageData.data[idx + 1] ?? 0,
    b: imageData.data[idx + 2] ?? 0
  }
}

export function colorDistance(c1: RGB, c2: RGB): number {
  const dr = c1.r - c2.r
  const dg = c1.g - c2.g
  const db = c1.b - c2.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result || !result[1] || !result[2] || !result[3]) return null
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  }
}

export const PALETTE: { light: PaletteGroup; dark: PaletteGroup } = {
  light: {
    name: 'Light',
    colors: [
      { name: 'pink', value: '#FFB6C1' },
      { name: 'yellow', value: '#FFFFE0' },
      { name: 'green', value: '#90EE90' },
      { name: 'blue', value: '#ADD8E6' },
      { name: 'red', value: '#FFA07A' },
      { name: 'purple', value: '#DDA0DD' },
      { name: 'gray', value: '#D3D3D3' },
      { name: 'orange', value: '#FFDAB9' },
      { name: 'brown', value: '#D2B48C' },
      { name: 'white', value: '#FFFFFF' }
    ]
  },
  dark: {
    name: 'Dark',
    colors: [
      { name: 'pink', value: '#C71585' },
      { name: 'yellow', value: '#FFD700' },
      { name: 'green', value: '#228B22' },
      { name: 'blue', value: '#0000CD' },
      { name: 'red', value: '#8B0000' },
      { name: 'purple', value: '#800080' },
      { name: 'gray', value: '#696969' },
      { name: 'orange', value: '#FF8C00' },
      { name: 'brown', value: '#8B4513' },
      { name: 'black', value: '#000000' }
    ]
  }
}

interface PaletteGroup {
  name: string
  colors: { name: string; value: string }[]
}
