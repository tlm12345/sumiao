import { getPixelColor, type RGB } from '@/utils/color'

export interface FloodFillOptions {
  imageData: ImageData
  startX: number
  startY: number
  threshold: number
}

export function useFloodFill() {
  function floodFill(options: FloodFillOptions): Set<number> {
    const { imageData, startX, startY, threshold } = options
    const { width, height } = imageData

    if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
      return new Set()
    }

    const visited = new Set<number>()
    const result = new Set<number>()
    const queue: [number, number][] = [[startX, startY]]

    const startColor = getPixelColor(imageData, startX, startY)
    const thresholdSquared = threshold * threshold

    while (queue.length > 0) {
      const [x, y] = queue.shift()!
      const idx = y * width + x

      if (visited.has(idx)) continue
      visited.add(idx)

      const color = getPixelColor(imageData, x, y)

      if (colorDistanceSquared(startColor, color) <= thresholdSquared) {
        result.add(idx)

        // 4-connected neighbors
        if (x > 0) queue.push([x - 1, y])
        if (x < width - 1) queue.push([x + 1, y])
        if (y > 0) queue.push([x, y - 1])
        if (y < height - 1) queue.push([x, y + 1])

        // 4-connected diagonal neighbors for smoother selection
        if (x > 0 && y > 0) queue.push([x - 1, y - 1])
        if (x < width - 1 && y > 0) queue.push([x + 1, y - 1])
        if (x > 0 && y < height - 1) queue.push([x - 1, y + 1])
        if (x < width - 1 && y < height - 1) queue.push([x + 1, y + 1])
      }
    }

    return result
  }

  function colorDistanceSquared(c1: RGB, c2: RGB): number {
    const dr = c1.r - c2.r
    const dg = c1.g - c2.g
    const db = c1.b - c2.b
    return dr * dr + dg * dg + db * db
  }

  return {
    floodFill
  }
}
