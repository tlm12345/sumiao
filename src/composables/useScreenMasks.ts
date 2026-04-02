import { ref, computed, watch, type Ref } from 'vue'
import type { Mask, Point } from '@/types'
import { decodeMaskPixels, iterateMaskPixels } from '@/utils/maskEncoding'

export interface ScreenMask {
  maskId: string
  // 屏幕坐标系下的边界框
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  // 屏幕坐标系下的像素点集合（使用 Set 提高查询效率）
  screenPixels: Set<string> // 格式: "x,y"
}

export function useScreenMasks(
  masks: Ref<Map<string, Mask>>,
  scale: Ref<number>,
  offset: Ref<Point>,
  imageWidth: Ref<number>,
  imageHeight: Ref<number>
) {
  // 屏幕坐标系下的掩码表示
  const screenMasks = ref<Map<string, ScreenMask>>(new Map())
  // 记录生成 screenMasks 时的缩放比例
  const screenMasksScale = ref(1)
  const screenMasksOffset = ref<Point>({ x: 0, y: 0 })

  // 检查当前 screenMasks 是否仍然有效（缩放比例未改变）
  const isScreenMasksValid = computed(() => {
    return (
      Math.abs(screenMasksScale.value - scale.value) < 0.001 &&
      Math.abs(screenMasksOffset.value.x - offset.value.x) < 0.5 &&
      Math.abs(screenMasksOffset.value.y - offset.value.y) < 0.5
    )
  })

  // 生成屏幕坐标系下的掩码表示
  function generateScreenMasks(): void {
    const newScreenMasks = new Map<string, ScreenMask>()

    masks.value.forEach((mask, maskId) => {
      if (!mask.visible) return

      const screenPixels = new Set<string>()
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      // 使用迭代器遍历掩码像素，避免一次性解码所有像素
      for (const pixelIdx of iterateMaskPixels(mask.rows, imageWidth.value)) {
        // 将原始像素索引转换为原始坐标
        const origX = pixelIdx % imageWidth.value
        const origY = Math.floor(pixelIdx / imageWidth.value)

        // 转换为屏幕坐标
        const screenX = Math.round(origX * scale.value + offset.value.x)
        const screenY = Math.round(origY * scale.value + offset.value.y)

        screenPixels.add(`${screenX},${screenY}`)

        // 更新边界
        minX = Math.min(minX, screenX)
        minY = Math.min(minY, screenY)
        maxX = Math.max(maxX, screenX)
        maxY = Math.max(maxY, screenY)
      }

      if (screenPixels.size > 0) {
        newScreenMasks.set(maskId, {
          maskId,
          bounds: { minX, minY, maxX, maxY },
          screenPixels
        })
      }
    })

    screenMasks.value = newScreenMasks
    screenMasksScale.value = scale.value
    screenMasksOffset.value = { ...offset.value }
  }

  // 屏幕坐标点击检测
  function hitTestScreen(screenX: number, screenY: number): string | null {
    // 如果 screenMasks 无效，先重新生成
    if (!isScreenMasksValid.value) {
      generateScreenMasks()
    }

    // 将点击坐标取整
    const checkX = Math.round(screenX)
    const checkY = Math.round(screenY)
    const key = `${checkX},${checkY}`

    // 遍历所有 screenMasks 进行检测
    for (const [maskId, screenMask] of screenMasks.value) {
      // 快速边界框检测
      if (
        checkX < screenMask.bounds.minX ||
        checkX > screenMask.bounds.maxX ||
        checkY < screenMask.bounds.minY ||
        checkY > screenMask.bounds.maxY
      ) {
        continue
      }

      // 精确像素检测
      if (screenMask.screenPixels.has(key)) {
        return maskId
      }
    }

    return null
  }

  // 监听缩放和偏移变化，标记为无效
  watch([scale, offset], () => {
    // screenMasks 现在无效，将在下次 hitTest 时重新生成
  })

  // 监听掩码变化，重新生成
  watch(
    () => Array.from(masks.value.values()).map(m => ({
      id: m.id,
      visible: m.visible,
      pixelCount: m.pixelCount || 0
    })),
    () => {
      generateScreenMasks()
    },
    { deep: true }
  )

  return {
    screenMasks,
    isScreenMasksValid,
    generateScreenMasks,
    hitTestScreen
  }
}
