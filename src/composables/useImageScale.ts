import { ref, computed, type Ref } from 'vue'
import type { Point } from '@/types'

export interface ImageScaleState {
  scale: Ref<number>
  offset: Ref<Point>
  containerSize: Ref<{ width: number; height: number }>
  imageSize: Ref<{ width: number; height: number }>
}

export function useImageScale() {
  const scale = ref(1)
  const offset = ref<Point>({ x: 0, y: 0 })
  const containerSize = ref({ width: 0, height: 0 })
  const imageSize = ref({ width: 0, height: 0 })

  const scaledImageSize = computed(() => ({
    width: imageSize.value.width * scale.value,
    height: imageSize.value.height * scale.value
  }))

  function calculateInitialScale(): void {
    if (containerSize.value.width === 0 || containerSize.value.height === 0) return
    if (imageSize.value.width === 0 || imageSize.value.height === 0) return

    const scaleX = containerSize.value.width / imageSize.value.width
    const scaleY = containerSize.value.height / imageSize.value.height
    scale.value = Math.min(scaleX, scaleY) // Fit image to container, allow upscaling

    // Center the image
    centerImage()
  }

  function centerImage(): void {
    const scaledWidth = imageSize.value.width * scale.value
    const scaledHeight = imageSize.value.height * scale.value

    offset.value = {
      x: (containerSize.value.width - scaledWidth) / 2,
      y: (containerSize.value.height - scaledHeight) / 2
    }
  }

  function screenToImage(screenX: number, screenY: number): Point {
    return {
      x: Math.floor((screenX - offset.value.x) / scale.value),
      y: Math.floor((screenY - offset.value.y) / scale.value)
    }
  }

  function imageToScreen(imgX: number, imgY: number): Point {
    return {
      x: imgX * scale.value + offset.value.x,
      y: imgY * scale.value + offset.value.y
    }
  }

  function setScale(newScale: number): void {
    scale.value = Math.max(0.1, Math.min(newScale, 5))
    centerImage()
  }

  function zoomIn(): void {
    setScale(scale.value * 1.2)
  }

  function zoomOut(): void {
    setScale(scale.value / 1.2)
  }

  function resetZoom(): void {
    calculateInitialScale()
  }

  function updateContainerSize(width: number, height: number): void {
    containerSize.value = { width, height }
    calculateInitialScale()
  }

  function setImageSize(width: number, height: number): void {
    imageSize.value = { width, height }
    calculateInitialScale()
  }

  return {
    scale,
    offset,
    containerSize,
    imageSize,
    scaledImageSize,
    screenToImage,
    imageToScreen,
    setScale,
    zoomIn,
    zoomOut,
    resetZoom,
    updateContainerSize,
    setImageSize,
    calculateInitialScale,
    centerImage
  }
}
