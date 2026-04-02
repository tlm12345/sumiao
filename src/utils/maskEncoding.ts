import type { RowMask, MaskBounds } from '@/types'

/**
 * 将像素索引集合编码为行式区间计数法（RLE per row）
 * @param pixels 像素索引集合（扁平索引：y * width + x）
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 每行的掩码表示
 */
export function encodeMaskPixels(pixels: Set<number>, width: number, height: number): RowMask[] {
  const rows: RowMask[] = new Array(height).fill(0)

  if (pixels.size === 0) {
    return rows
  }

  // 按行分组像素
  const rowPixels: number[][] = Array.from({ length: height }, () => [])

  for (const pixelIdx of pixels) {
    const y = Math.floor(pixelIdx / width)
    const x = pixelIdx % width
    if (y >= 0 && y < height && x >= 0 && x < width) {
      rowPixels[y]!.push(x)
    }
  }

  // 对每行的像素进行区间编码
  for (let y = 0; y < height; y++) {
    const cols = rowPixels[y]!
    if (cols.length === 0) {
      rows[y] = 0
      continue
    }

    // 排序并合并连续区间
    cols.sort((a, b) => a - b)
    const intervals: [number, number][] = []
    let start = cols[0]!
    let end = cols[0]!

    for (let i = 1; i < cols.length; i++) {
      const col = cols[i]!
      if (col === end + 1) {
        // 连续，扩展区间
        end = col
      } else {
        // 不连续，保存当前区间，开始新区间
        intervals.push([start, end])
        start = col
        end = col
      }
    }
    intervals.push([start, end])
    rows[y] = intervals
  }

  return rows
}

/**
 * 将行式区间计数法解码为像素索引集合
 * @param rows 每行的掩码表示
 * @param width 图像宽度
 * @returns 像素索引集合
 */
export function decodeMaskPixels(rows: RowMask[], width: number): Set<number> {
  const pixels = new Set<number>()

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!
    if (row === 0) continue

    for (const [startCol, endCol] of row) {
      for (let x = startCol; x <= endCol; x++) {
        pixels.add(y * width + x)
      }
    }
  }

  return pixels
}

/**
 * 计算掩码的边界框
 * @param rows 每行的掩码表示
 * @param width 图像宽度
 * @returns 边界框，如果没有像素则返回 null
 */
export function calculateMaskBounds(rows: RowMask[], width: number): MaskBounds | null {
  let minX = width
  let maxX = -1
  let minY = rows.length
  let maxY = -1
  let hasPixels = false

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!
    if (row === 0) continue

    hasPixels = true
    if (y < minY) minY = y
    if (y > maxY) maxY = y

    for (const [startCol, endCol] of row) {
      if (startCol < minX) minX = startCol
      if (endCol > maxX) maxX = endCol
    }
  }

  if (!hasPixels) {
    return null
  }

  return { minX, maxX, minY, maxY }
}

/**
 * 更新掩码的行数据，添加新的像素
 * @param rows 当前的行数据
 * @param newPixels 要添加的新像素
 * @param width 图像宽度
 * @returns 更新后的行数据
 */
export function addPixelsToRows(rows: RowMask[], newPixels: Set<number>, width: number): RowMask[] {
  // 先解码现有像素
  const existingPixels = decodeMaskPixels(rows, width)

  // 合并新像素
  for (const pixel of newPixels) {
    existingPixels.add(pixel)
  }

  // 重新编码
  return encodeMaskPixels(existingPixels, width, rows.length)
}

/**
 * 从掩码中移除像素
 * @param rows 当前的行数据
 * @param pixelsToRemove 要移除的像素
 * @param width 图像宽度
 * @returns 更新后的行数据
 */
export function removePixelsFromRows(rows: RowMask[], pixelsToRemove: Set<number>, width: number): RowMask[] {
  // 解码现有像素
  const existingPixels = decodeMaskPixels(rows, width)

  // 移除指定像素
  for (const pixel of pixelsToRemove) {
    existingPixels.delete(pixel)
  }

  // 重新编码
  return encodeMaskPixels(existingPixels, width, rows.length)
}

/**
 * 计算掩码中的像素数量
 * @param rows 每行的掩码表示
 * @returns 像素总数
 */
export function countMaskPixels(rows: RowMask[]): number {
  let count = 0

  for (const row of rows) {
    if (row === 0) continue

    for (const [startCol, endCol] of row) {
      count += endCol - startCol + 1
    }
  }

  return count
}

/**
 * 检查某像素是否在掩码中
 * @param rows 每行的掩码表示
 * @param x 列坐标
 * @param y 行坐标
 * @param width 图像宽度
 * @returns 是否在掩码中
 */
export function isPixelInMask(rows: RowMask[], x: number, y: number, width: number): boolean {
  if (y < 0 || y >= rows.length || x < 0 || x >= width) {
    return false
  }

  const row = rows[y]!
  if (row === 0) return false

  for (const [startCol, endCol] of row) {
    if (x >= startCol && x <= endCol) {
      return true
    }
  }

  return false
}

/**
 * 获取掩码中的所有像素索引（迭代器）
 * 比 decodeMaskPixels 更节省内存，适合遍历
 * @param rows 每行的掩码表示
 * @param width 图像宽度
 */
export function* iterateMaskPixels(rows: RowMask[], width: number): Generator<number> {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!
    if (row === 0) continue

    for (const [startCol, endCol] of row) {
      for (let x = startCol; x <= endCol; x++) {
        yield y * width + x
      }
    }
  }
}

/**
 * 压缩行数据（合并相邻的相同区间，移除空行）
 * 用于优化存储
 * @param rows 原始行数据
 * @returns 优化后的行数据
 */
export function compressRows(rows: RowMask[]): RowMask[] {
  // 移除末尾的空行
  let lastNonEmpty = rows.length - 1
  while (lastNonEmpty >= 0 && rows[lastNonEmpty] === 0) {
    lastNonEmpty--
  }

  if (lastNonEmpty < 0) {
    return []
  }

  // 只保留到最后一行非空行
  return rows.slice(0, lastNonEmpty + 1)
}

/**
 * 创建空掩码行数据
 * @param height 图像高度
 * @returns 初始化为0的行数组
 */
export function createEmptyRows(height: number): RowMask[] {
  return new Array(height).fill(0)
}
