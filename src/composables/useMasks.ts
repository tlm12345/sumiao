import { ref, computed, type Ref } from 'vue'
import type { Mask } from '@/types'

export function useMasks() {
  const masks: Ref<Map<string, Mask>> = ref(new Map())
  const activeMaskId: Ref<string | null> = ref(null)

  // Reverse index: pixel index -> mask id
  const pixelToMask: Ref<Map<number, string>> = ref(new Map())

  const maskList = computed(() => Array.from(masks.value.values()))
  const visibleMasks = computed(() => maskList.value.filter(m => m.visible))

  function generateId(): string {
    return `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  function createMask(name: string, pixels: Set<number>, createdAtScale: number = 1): string {
    const id = generateId()
    const mask: Mask = {
      id,
      name,
      pixels,
      fillColor: null,
      visible: true,
      createdAtScale
    }
    masks.value.set(id, mask)
    activeMaskId.value = id

    // Update reverse index
    pixels.forEach(pixelIdx => {
      pixelToMask.value.set(pixelIdx, id)
    })

    return id
  }

  function deleteMask(id: string): void {
    const mask = masks.value.get(id)
    if (mask) {
      // Remove from reverse index
      mask.pixels.forEach(pixelIdx => {
        pixelToMask.value.delete(pixelIdx)
      })
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

  function getMaskAtPixel(pixelIdx: number): Mask | undefined {
    const maskId = pixelToMask.value.get(pixelIdx)
    if (maskId) {
      return masks.value.get(maskId)
    }
    return undefined
  }

  function clearAllMasks(): void {
    masks.value.clear()
    pixelToMask.value.clear()
    activeMaskId.value = null
  }

  function isPixelInMask(pixelIdx: number, maskId: string): boolean {
    const mask = masks.value.get(maskId)
    return mask ? mask.pixels.has(pixelIdx) : false
  }

  function addPixelsToMask(maskId: string, pixels: Set<number>): void {
    const mask = masks.value.get(maskId)
    if (!mask) return

    pixels.forEach(pixelIdx => {
      // Remove from old mask if pixel already belongs to another mask
      const oldMaskId = pixelToMask.value.get(pixelIdx)
      if (oldMaskId && oldMaskId !== maskId) {
        const oldMask = masks.value.get(oldMaskId)
        if (oldMask) {
          oldMask.pixels.delete(pixelIdx)
        }
      }
      // Add to new mask
      mask.pixels.add(pixelIdx)
      pixelToMask.value.set(pixelIdx, maskId)
    })
  }

  /**
   * 从导入的数据加载掩码状态
   */
  function loadFromImport(
    importedMasks: Map<string, Mask>,
    importedPixelToMask: Map<number, string>
  ): void {
    masks.value = importedMasks
    pixelToMask.value = importedPixelToMask
    activeMaskId.value = null
  }

  return {
    masks,
    activeMaskId,
    maskList,
    visibleMasks,
    pixelToMask,
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
    loadFromImport
  }
}
