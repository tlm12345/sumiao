import { ref, computed, type Ref } from 'vue'
import type { Mask, RowMask, MaskBounds, LegacyMask } from '@/types'
import {
  encodeMaskPixels,
  decodeMaskPixels,
  calculateMaskBounds,
  countMaskPixels,
  iterateMaskPixels,
  addPixelsToRows,
  createEmptyRows
} from '@/utils/maskEncoding'

export interface UseMasksOptions {
  imageWidth?: Ref<number>
  imageHeight?: Ref<number>
}

export function useMasks(options?: UseMasksOptions) {
  const masks: Ref<Map<string, Mask>> = ref(new Map())
  const activeMaskId: Ref<string | null> = ref(null)

  // Reverse index: pixel index -> mask id
  // 注意：这个索引在内部仍然使用，但基于行数据动态构建
  const pixelToMask: Ref<Map<number, string>> = ref(new Map())

  const maskList = computed(() => Array.from(masks.value.values()))
  const visibleMasks = computed(() => maskList.value.filter(m => m.visible))

  // 当前图像尺寸（用于编码/解码）
  const imageWidth = options?.imageWidth ?? ref(0)
  const imageHeight = options?.imageHeight ?? ref(0)

  function generateId(): string {
    return `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 重建像素到掩码的反向索引
   * 在掩码数据变化后调用
   */
  function rebuildPixelToMask(): void {
    pixelToMask.value.clear()

    for (const [id, mask] of masks.value) {
      for (const pixelIdx of iterateMaskPixels(mask.rows, imageWidth.value)) {
        pixelToMask.value.set(pixelIdx, id)
      }
    }
  }

  /**
   * 创建新掩码
   * @param name 掩码名称
   * @param pixels 像素索引集合
   * @param createdAtScale 创建时的缩放比例
   * @returns 新掩码的ID
   */
  function createMask(name: string, pixels: Set<number>, createdAtScale: number = 1): string {
    const id = generateId()

    // 将像素编码为行式格式
    const rows = encodeMaskPixels(pixels, imageWidth.value, imageHeight.value)
    const bounds = calculateMaskBounds(rows, imageWidth.value)

    if (!bounds) {
      console.warn('[useMasks] Attempted to create empty mask')
      return ''
    }

    const mask: Mask = {
      id,
      name,
      rows,
      bounds,
      fillColor: null,
      visible: true,
      createdAtScale,
      pixelCount: countMaskPixels(rows)
    }

    masks.value.set(id, mask)
    activeMaskId.value = id

    // Update reverse index
    for (const pixelIdx of pixels) {
      pixelToMask.value.set(pixelIdx, id)
    }

    return id
  }

  /**
   * 删除掩码
   * @param id 掩码ID
   */
  function deleteMask(id: string): void {
    const mask = masks.value.get(id)
    if (mask) {
      // Remove from reverse index
      for (const pixelIdx of iterateMaskPixels(mask.rows, imageWidth.value)) {
        pixelToMask.value.delete(pixelIdx)
      }
      masks.value.delete(id)

      if (activeMaskId.value === id) {
        activeMaskId.value = null
      }
    }
  }

  function setActiveMask(id: string | null): void {
    activeMaskId.value = id
  }

  function renameMask(id: string, newName: string): void {
    const mask = masks.value.get(id)
    if (mask) {
      mask.name = newName
    }
  }

  function toggleMaskVisibility(id: string): void {
    const mask = masks.value.get(id)
    if (mask) {
      mask.visible = !mask.visible
    }
  }

  function setMaskFillColor(id: string, color: string | null): void {
    const mask = masks.value.get(id)
    if (mask) {
      mask.fillColor = color
    }
  }

  /**
   * 获取某像素所属的掩码
   * @param pixelIdx 像素索引
   * @returns 掩码对象或 undefined
   */
  function getMaskAtPixel(pixelIdx: number): Mask | undefined {
    const maskId = pixelToMask.value.get(pixelIdx)
    if (maskId) {
      return masks.value.get(maskId)
    }
    return undefined
  }

  /**
   * 清空所有掩码
   */
  function clearAllMasks(): void {
    masks.value.clear()
    pixelToMask.value.clear()
    activeMaskId.value = null
  }

  /**
   * 检查某像素是否在指定掩码中
   * @param pixelIdx 像素索引
   * @param maskId 掩码ID
   * @returns 是否在掩码中
   */
  function isPixelInMask(pixelIdx: number, maskId: string): boolean {
    const mask = masks.value.get(maskId)
    if (!mask) return false

    const y = Math.floor(pixelIdx / imageWidth.value)
    const x = pixelIdx % imageWidth.value

    return isPixelInMaskAtCoords(mask, x, y)
  }

  /**
   * 检查某坐标是否在掩码中
   * @param mask 掩码对象
   * @param x 列坐标
   * @param y 行坐标
   * @returns 是否在掩码中
   */
  function isPixelInMaskAtCoords(mask: Mask, x: number, y: number): boolean {
    if (y < 0 || y >= mask.rows.length || x < 0 || x >= imageWidth.value) {
      return false
    }

    const row = mask.rows[y]!
    if (row === 0) return false

    for (const [startCol, endCol] of row) {
      if (x >= startCol && x <= endCol) {
        return true
      }
    }

    return false
  }

  /**
   * 添加像素到现有掩码
   * @param maskId 掩码ID
   * @param pixels 要添加的像素集合
   */
  function addPixelsToMask(maskId: string, pixels: Set<number>): void {
    const mask = masks.value.get(maskId)
    if (!mask) return

    // Remove from old mask if pixel already belongs to another mask
    for (const pixelIdx of pixels) {
      const oldMaskId = pixelToMask.value.get(pixelIdx)
      if (oldMaskId && oldMaskId !== maskId) {
        const oldMask = masks.value.get(oldMaskId)
        if (oldMask) {
          // 从旧掩码中移除该像素
          oldMask.rows = removePixelFromRows(oldMask.rows, pixelIdx, imageWidth.value)
          oldMask.bounds = calculateMaskBounds(oldMask.rows, imageWidth.value) || oldMask.bounds
          oldMask.pixelCount = countMaskPixels(oldMask.rows)
        }
      }
      // Add to new mask
      pixelToMask.value.set(pixelIdx, maskId)
    }

    // 更新掩码的行数据
    mask.rows = addPixelsToRows(mask.rows, pixels, imageWidth.value)
    mask.bounds = calculateMaskBounds(mask.rows, imageWidth.value) || mask.bounds
    mask.pixelCount = countMaskPixels(mask.rows)
  }

  /**
   * 从行数据中移除单个像素（辅助函数）
   */
  function removePixelFromRows(rows: RowMask[], pixelIdx: number, width: number): RowMask[] {
    const y = Math.floor(pixelIdx / width)
    const x = pixelIdx % width

    if (y < 0 || y >= rows.length) return rows

    const row = rows[y]!
    if (row === 0) return rows

    const newIntervals: [number, number][] = []

    for (const [startCol, endCol] of row) {
      if (x < startCol || x > endCol) {
        // 不在此区间内，保留
        newIntervals.push([startCol, endCol])
      } else if (x === startCol && x === endCol) {
        // 区间只有一个像素，且被移除，跳过
        continue
      } else if (x === startCol) {
        // 移除区间左端
        newIntervals.push([startCol + 1, endCol])
      } else if (x === endCol) {
        // 移除区间右端
        newIntervals.push([startCol, endCol - 1])
      } else {
        // 移除区间中间，分裂为两个区间
        newIntervals.push([startCol, x - 1])
        newIntervals.push([x + 1, endCol])
      }
    }

    const newRows = [...rows]
    newRows[y] = newIntervals.length > 0 ? newIntervals : 0
    return newRows
  }

  /**
   * 获取掩码的像素集合（解码）
   * 用于需要 Set<number> 的兼容性场景
   * @param mask 掩码对象或ID
   * @returns 像素索引集合
   */
  function getMaskPixels(mask: Mask | string): Set<number> {
    const m = typeof mask === 'string' ? masks.value.get(mask) : mask
    if (!m) return new Set()

    return decodeMaskPixels(m.rows, imageWidth.value)
  }

  /**
   * 从导入的数据加载掩码状态
   * @param importedMasks 导入的掩码Map
   * @param importedPixelToMask 导入的反向索引
   */
  function loadFromImport(
    importedMasks: Map<string, Mask>,
    importedPixelToMask: Map<number, string>
  ): void {
    masks.value = importedMasks
    pixelToMask.value = importedPixelToMask
    activeMaskId.value = null
  }

  /**
   * 从旧格式（LegacyMask）创建新格式掩码
   * @param legacy 旧格式掩码
   * @returns 新格式掩码
   */
  function convertLegacyMask(legacy: LegacyMask): Mask {
    const pixels = new Set(legacy.pixels)
    const rows = encodeMaskPixels(pixels, imageWidth.value, imageHeight.value)
    const bounds = calculateMaskBounds(rows, imageWidth.value)

    return {
      id: legacy.id,
      name: legacy.name,
      rows,
      bounds: bounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      fillColor: legacy.fillColor,
      visible: legacy.visible,
      createdAtScale: legacy.createdAtScale,
      pixelCount: countMaskPixels(rows)
    }
  }

  /**
   * 设置图像尺寸（在加载新图像时调用）
   * @param width 图像宽度
   * @param height 图像高度
   */
  function setImageSize(width: number, height: number): void {
    imageWidth.value = width
    imageHeight.value = height
  }

  return {
    // State
    masks,
    activeMaskId,
    maskList,
    visibleMasks,
    pixelToMask,

    // CRUD
    createMask,
    deleteMask,
    setActiveMask,
    renameMask,
    toggleMaskVisibility,
    setMaskFillColor,
    getMaskAtPixel,
    clearAllMasks,
    isPixelInMask,
    addPixelsToMask,
    loadFromImport,

    // Utilities
    getMaskPixels,
    convertLegacyMask,
    setImageSize,
    rebuildPixelToMask
  }
}
