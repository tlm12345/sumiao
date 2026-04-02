<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { Mask, Mode, Point } from '@/types'

const props = defineProps<{
  mode: Mode
  imageData: ImageData | null
  masks: Map<string, Mask>
  activeMaskId: string | null
  scale: number
  offset: Point
  threshold: number
  locked?: boolean
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

// Render canvas
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

  // Draw mask overlays
  props.masks.forEach(mask => {
    if (!mask.visible) return

    // Draw fill color if set
    if (mask.fillColor) {
      ctx.fillStyle = mask.fillColor + '80' // 50% opacity
      mask.pixels.forEach(idx => {
        const x = idx % props.imageData!.width
        const y = Math.floor(idx / props.imageData!.width)
        ctx.fillRect(x, y, 1, 1)
      })
    }

    // Highlight active mask with light blue overlay
    if (mask.id === props.activeMaskId && props.mode === 'segment') {
      ctx.fillStyle = 'rgba(135, 206, 250, 0.5)' // Light blue with 50% opacity
      mask.pixels.forEach(idx => {
        const x = idx % props.imageData!.width
        const y = Math.floor(idx / props.imageData!.width)
        ctx.fillRect(x, y, 1, 1)
      })
    }
  })

  ctx.restore()
}

// Watch for changes that require re-render
watch(() => props.imageData, renderCanvas, { deep: true })
watch(() => props.masks, renderCanvas, { deep: true })
watch(() => props.activeMaskId, renderCanvas)
watch(() => props.scale, renderCanvas)
watch(() => props.offset, renderCanvas, { deep: true })

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
