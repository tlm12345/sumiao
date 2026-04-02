<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { Mask, Mode, Point } from '@/types'
import { hexToRgb } from '@/utils/color'
import { iterateMaskPixels, decodeMaskPixels } from '@/utils/maskEncoding'

const props = defineProps<{
  mode: Mode
  imageData: ImageData | null
  masks: Map<string, Mask>
  activeMaskId: string | null
  scale: number
  offset: Point
  threshold: number
  locked?: boolean
  mergedMaskMatrix?: Uint32Array | null
  maskIdToNumber?: Map<string, number>
}>()

const emit = defineEmits<{
  (e: 'pixelClick', point: Point): void
  (e: 'update:scale', value: number): void
  (e: 'update:offset', value: Point): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Internal state for panning
const isDragging = ref(false)
const dragStart = ref<Point>({ x: 0, y: 0 })
const offsetStart = ref<Point>({ x: 0, y: 0 })

// Optimized render using batch drawing via ImageData
const renderCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas || !props.imageData) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Save context for transforms
  ctx.save()

  // Apply offset and scale
  ctx.translate(props.offset.x, props.offset.y)
  ctx.scale(props.scale, props.scale)

  // Draw original image
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = props.imageData.width
  tempCanvas.height = props.imageData.height
  const tempCtx = tempCanvas.getContext('2d')
  if (tempCtx) {
    tempCtx.putImageData(props.imageData, 0, 0)
    ctx.drawImage(tempCanvas, 0, 0)
  }

  // Build a color cache for masks to avoid repeated hexToRgb calls
  const colorCache = new Map<string, { r: number; g: number; b: number }>()

  // Get all visible masks with fill colors
  const visibleFilledMasks = new Map<string, Mask>()
  props.masks.forEach(mask => {
    if (mask.visible && mask.fillColor) {
      visibleFilledMasks.set(mask.id, mask)
    }
  })

  // If we have merged mask matrix and fill mode, use optimized batch rendering
  if (props.mergedMaskMatrix && visibleFilledMasks.size > 0 && props.maskIdToNumber) {
    const { width, height } = props.imageData
    const overlayImageData = ctx.createImageData(width, height)
    const data = overlayImageData.data

    // Build maskNumber -> color map directly using maskIdToNumber
    // This avoids rebuilding pixel->maskId map on every render
    const maskNumberToColor = new Map<number, { r: number; g: number; b: number }>()
    visibleFilledMasks.forEach((mask, id) => {
      const maskNumber = props.maskIdToNumber!.get(id)
      if (maskNumber === undefined) return

      const color = mask.fillColor!
      let rgb = colorCache.get(color)
      if (!rgb) {
        const newRgb = hexToRgb(color)
        if (newRgb) {
          rgb = newRgb
          colorCache.set(color, rgb)
        }
      }
      if (rgb) {
        maskNumberToColor.set(maskNumber, rgb)
      }
    })

    // Fill the overlay ImageData - direct lookup by mask number
    for (let i = 0; i < props.mergedMaskMatrix.length; i++) {
      const maskNumber = props.mergedMaskMatrix[i]!
      if (maskNumber === 0) continue

      const color = maskNumberToColor.get(maskNumber)
      if (!color) continue

      const idx = i * 4
      data[idx] = color.r
      data[idx + 1] = color.g
      data[idx + 2] = color.b
      data[idx + 3] = 128 // 50% opacity
    }

    // Create a temporary canvas for the overlay to enable alpha blending
    const overlayCanvas = document.createElement('canvas')
    overlayCanvas.width = width
    overlayCanvas.height = height
    const overlayCtx = overlayCanvas.getContext('2d')
    if (overlayCtx) {
      overlayCtx.putImageData(overlayImageData, 0, 0)
      // Draw with alpha blending - this preserves the original image underneath
      ctx.drawImage(overlayCanvas, 0, 0)
    }
  } else {
    // Fallback to original method for segment mode or when no matrix available
    props.masks.forEach(mask => {
      if (!mask.visible) return

      // Draw fill color if set
      if (mask.fillColor) {
        ctx.fillStyle = mask.fillColor + '80' // 50% opacity
        // 使用迭代器遍历新的 rows 格式
        for (const idx of iterateMaskPixels(mask.rows, props.imageData!.width)) {
          const x = idx % props.imageData!.width
          const y = Math.floor(idx / props.imageData!.width)
          ctx.fillRect(x, y, 1, 1)
        }
      }
    })
  }

  // Always render active mask highlight (segment mode) using original method
  // This is typically small and doesn't need optimization
  if (props.mode === 'segment' && props.activeMaskId) {
    const activeMask = props.masks.get(props.activeMaskId)
    if (activeMask && activeMask.visible) {
      ctx.fillStyle = 'rgba(135, 206, 250, 0.5)' // Light blue with 50% opacity
      // 使用迭代器遍历新的 rows 格式
      for (const idx of iterateMaskPixels(activeMask.rows, props.imageData!.width)) {
        const x = idx % props.imageData!.width
        const y = Math.floor(idx / props.imageData!.width)
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  ctx.restore()
}

// Watch for changes that require re-render
watch(() => props.imageData, renderCanvas, { deep: true })
watch(() => props.masks, renderCanvas, { deep: true })
watch(() => props.activeMaskId, renderCanvas)
watch(() => props.scale, renderCanvas)
watch(() => props.offset, renderCanvas, { deep: true })
watch(() => props.mergedMaskMatrix, renderCanvas)

// Handle click - emit screen coordinates
const handleClick = (e: MouseEvent) => {
  if (isDragging.value) return

  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top

  // Emit screen coordinates - parent will handle conversion
  emit('pixelClick', { x: screenX, y: screenY })
}

// Handle mouse down for panning
const handleMouseDown = (e: MouseEvent) => {
  if (props.locked) return
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    isDragging.value = true
    dragStart.value = { x: e.clientX, y: e.clientY }
    offsetStart.value = { ...props.offset }
    e.preventDefault()
  }
}

// Handle mouse move for panning
const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return

  const dx = e.clientX - dragStart.value.x
  const dy = e.clientY - dragStart.value.y

  emit('update:offset', {
    x: offsetStart.value.x + dx,
    y: offsetStart.value.y + dy
  })
}

// Handle mouse up
const handleMouseUp = () => {
  isDragging.value = false
}

// Handle wheel for zooming
const handleWheel = (e: WheelEvent) => {
  if (props.locked) return
  e.preventDefault()
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.max(0.1, Math.min(props.scale * zoomFactor, 5))

  // Zoom towards mouse position
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // Calculate new offset to zoom towards mouse
  const scaleRatio = newScale / props.scale
  const newOffsetX = mouseX - (mouseX - props.offset.x) * scaleRatio
  const newOffsetY = mouseY - (mouseY - props.offset.y) * scaleRatio

  emit('update:scale', newScale)
  emit('update:offset', { x: newOffsetX, y: newOffsetY })
}

// Initialize canvas size
const updateCanvasSize = () => {
  const container = containerRef.value
  if (!container) return

  const canvas = canvasRef.value
  if (!canvas) return

  canvas.width = container.clientWidth
  canvas.height = container.clientHeight

  renderCanvas()
}

onMounted(() => {
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div ref="containerRef" class="canvas-container">
    <canvas
      ref="canvasRef"
      :class="['image-canvas', { 'is-segment': locked && mode === 'segment' }]"
      @click="handleClick"
      @mousedown="handleMouseDown"
      @wheel.prevent="handleWheel"
    />
  </div>
</template>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: #1a1a1a;
}

.image-canvas {
  display: block;
  cursor: default;
}

.image-canvas.is-segment {
  cursor: crosshair;
}

.image-canvas:active {
  cursor: grabbing;
}
</style>
