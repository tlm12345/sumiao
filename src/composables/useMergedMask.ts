import { ref, type Ref } from 'vue'
import type { Mask } from '@/types'
import { iterateMaskPixels } from '@/utils/maskEncoding'

export function useMergedMask(
  imageData: Ref<ImageData | null>,
  masks: Ref<Map<string, Mask>>
) {
  // 合并掩码矩阵 - Uint32Array，每个元素存储掩码编号（0 = 无掩码）
  const mergedMaskMatrix = ref<Uint32Array | null>(null)

  // 编号 → 掩码ID 的映射
  const maskIdToNumber = ref<Map<string, number>>(new Map())
  const maskNumberToId = ref<Map<number, string>>(new Map())

  // 分配编号（从1开始，0保留表示无掩码）
  function assignMaskNumbers(): void {
    let nextNumber = 1
    maskIdToNumber.value.clear()
    maskNumberToId.value.clear()

    masks.value.forEach((mask, id) => {
      maskIdToNumber.value.set(id, nextNumber)
      maskNumberToId.value.set(nextNumber, id)
      nextNumber++
    })
  }

  // 重建合并掩码矩阵
  function rebuildMatrix(): void {
    if (!imageData.value) return

    const { width, height } = imageData.value
    const totalPixels = width * height

    // 分配新矩阵（初始化为0）
    mergedMaskMatrix.value = new Uint32Array(totalPixels)

    // 分配编号
    assignMaskNumbers()

    // 填充矩阵 - 使用新的 rows 格式
    masks.value.forEach((mask, id) => {
      const maskNumber = maskIdToNumber.value.get(id)
      if (!maskNumber) return

      // 使用迭代器遍历掩码像素
      for (const pixelIdx of iterateMaskPixels(mask.rows, width)) {
        mergedMaskMatrix.value![pixelIdx] = maskNumber
      }
    })

    console.log(`[useMergedMask] Matrix rebuilt: ${masks.value.size} masks, ${totalPixels} pixels`)
  }

  // 获取某像素的掩码编号
  function getMaskNumberAtPixel(pixelIdx: number): number {
    return mergedMaskMatrix.value?.[pixelIdx] ?? 0
  }

  // 根据编号获取掩码ID
  function getMaskIdByNumber(number: number): string | undefined {
    return maskNumberToId.value.get(number)
  }

  // 根据编号获取掩码
  function getMaskByNumber(number: number): Mask | undefined {
    const id = maskNumberToId.value.get(number)
    return id ? masks.value.get(id) : undefined
  }

  // 获取所有带填充颜色的掩码编号
  function getMaskNumbersWithColors(): number[] {
    const numbers: number[] = []
    maskNumberToId.value.forEach((id, number) => {
      const mask = masks.value.get(id)
      if (mask?.fillColor) {
        numbers.push(number)
      }
    })
    return numbers
  }

  return {
    mergedMaskMatrix,
    maskIdToNumber,
    maskNumberToId,
    rebuildMatrix,
    getMaskNumberAtPixel,
    getMaskIdByNumber,
    getMaskByNumber,
    getMaskNumbersWithColors
  }
}
