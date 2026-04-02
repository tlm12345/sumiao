<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { Mode, Point, Mask } from '@/types'
import { useFloodFill } from '@/composables/useFloodFill'
import { useMasks } from '@/composables/useMasks'
import { useImageScale } from '@/composables/useImageScale'

import ImageCanvas from '@/components/ImageCanvas.vue'
import MaskPanel from '@/components/MaskPanel.vue'
import ColorPalette from '@/components/ColorPalette.vue'
import ModeSwitcher from '@/components/ModeSwitcher.vue'
import ThresholdSlider from '@/components/ThresholdSlider.vue'
import { useProjectStorage } from '@/composables/useProjectStorage'
import { useMergedMask } from '@/composables/useMergedMask'

// State
const mode = ref<Mode>('segment')
const imageData = ref<ImageData | null>(null)
const threshold = ref(30)
const clickedMaskId = ref<string | null>(null)
const selectedColor = ref<string | null>(null)  // 当前选中的颜色
const isPaletteCollapsed = ref(false)  // 调色板是否收缩

// Image dimensions (needed for mask encoding)
const imageWidth = ref(0)
const imageHeight = ref(0)

// Composables
const { floodFill } = useFloodFill()
const {
  masks,
  activeMaskId,
  maskList,
  pixelToMask,
  createMask,
  deleteMask,
  setActiveMask,
  renameMask,
  toggleMaskVisibility,
  setMaskFillColor,
  getMaskAtPixel,
  clearAllMasks,
  addPixelsToMask,
  loadFromImport,
  setImageSize: setMaskImageSize,
  rebuildPixelToMask
} = useMasks({
  imageWidth: imageWidth,
  imageHeight: imageHeight
})
const { importProject, exportProject, importFromDrop, isFileSystemAccessSupported, isExporting, lastError } = useProjectStorage()

const {
  scale,
  offset,
  setImageSize,
  updateContainerSize,
  screenToImage
} = useImageScale()

const {
  mergedMaskMatrix,
  maskIdToNumber,
  rebuildMatrix
} = useMergedMask(imageData, masks)

// File upload handling
const fileInputRef = ref<HTMLInputElement | null>(null)

const handleFileSelect = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (event) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        imageData.value = ctx.getImageData(0, 0, img.width, img.height)
        setImageSize(img.width, img.height)
        // Update dimensions for mask encoding
        imageWidth.value = img.width
        imageHeight.value = img.height
        if (containerRef.value) {
          updateContainerSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
        }
        // Reset lock and clear existing masks when loading new image
        canvasLocked.value = false
        clearAllMasks()
      }
    }
    img.src = event.target?.result as string
  }
  reader.readAsDataURL(file)
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

// Project import/export handling
const handleImportProject = async () => {
  const result = await importProject()
  if (!result) return

  // Restore image data first (needed for mask encoding)
  imageData.value = result.imageData
  imageWidth.value = result.imageData.width
  imageHeight.value = result.imageData.height
  setMaskImageSize(result.imageData.width, result.imageData.height)

  // Restore masks and pixel mapping
  loadFromImport(result.masks, result.pixelToMask)

  // Wait for DOM update then calculate image position
  await nextTick()

  if (containerRef.value) {
    // Set container size first (this calculates initial scale and centers image)
    updateContainerSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  }
  // Also set image size to ensure scale is calculated
  setImageSize(result.imageData.width, result.imageData.height)

  // Rebuild merged mask matrix for performance (after masks are loaded)
  rebuildMatrix()

  // Automatically enter fill mode and lock canvas
  mode.value = 'fill'
  canvasLocked.value = true
}

const handleExportProject = async () => {
  if (!imageData.value) return
  const success = await exportProject(imageData.value, masks.value)
  if (success) {
    alert('项目导出成功！')
  } else if (lastError.value) {
    alert('导出失败: ' + lastError.value)
  }
}

// Drag and drop handling
const isDraggingOver = ref(false)

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDraggingOver.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDraggingOver.value = false
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDraggingOver.value = false

  if (!e.dataTransfer) return

  const result = await importFromDrop(e.dataTransfer)
  if (!result) return

  // Restore image data first (needed for mask encoding)
  imageData.value = result.imageData
  imageWidth.value = result.imageData.width
  imageHeight.value = result.imageData.height
  setMaskImageSize(result.imageData.width, result.imageData.height)

  // Restore masks and pixel mapping
  loadFromImport(result.masks, result.pixelToMask)

  // Wait for DOM update then calculate image position
  await nextTick()

  if (containerRef.value) {
    // Set container size first (this calculates initial scale and centers image)
    updateContainerSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  }
  // Also set image size to ensure scale is calculated
  setImageSize(result.imageData.width, result.imageData.height)

  // Rebuild merged mask matrix for performance (after masks are loaded)
  rebuildMatrix()

  // Automatically enter fill mode and lock canvas
  mode.value = 'fill'
  canvasLocked.value = true
}

// Canvas click handling - now receives screen coordinates
const handleCanvasClick = async (screenPoint: Point) => {
  if (!imageData.value) return

  if (mode.value === 'segment') {
    // Convert screen coordinates to image coordinates
    const imgX = Math.floor((screenPoint.x - offset.value.x) / scale.value)
    const imgY = Math.floor((screenPoint.y - offset.value.y) / scale.value)

    // Check bounds
    if (imgX < 0 || imgX >= imageData.value.width || imgY < 0 || imgY >= imageData.value.height) {
      return
    }

    // Check if click is inside an existing mask
    const pixelIdx = imgY * imageData.value.width + imgX
    const existingMask = getMaskAtPixel(pixelIdx)

    if (existingMask) {
      // Select existing mask
      setActiveMask(existingMask.id)
      // Record scale when selecting an existing mask
      if (segmentStartScale.value === null) {
        segmentStartScale.value = scale.value
      }
    } else {
      // Flood fill to get new pixels
      const pixels = floodFill({
        imageData: imageData.value,
        startX: imgX,
        startY: imgY,
        threshold: threshold.value
      })

      if (pixels.size > 0) {
        if (activeMaskId.value) {
          // Add to current active mask
          addPixelsToMask(activeMaskId.value, pixels)
        } else {
          // Create new mask with current scale
          const newMaskName = `掩码 ${maskList.value.length + 1}`
          createMask(newMaskName, pixels, scale.value)
          // Record the scale when starting this mask
          segmentStartScale.value = scale.value
        }
      }
    }
  } else if (mode.value === 'fill') {
    // In fill mode, convert screen to image coordinates and check mask
    const imgX = Math.floor((screenPoint.x - offset.value.x) / scale.value)
    const imgY = Math.floor((screenPoint.y - offset.value.y) / scale.value)

    // Check bounds
    if (imgX < 0 || imgX >= imageData.value.width || imgY < 0 || imgY >= imageData.value.height) {
      return
    }

    // Check if click is inside a mask using image coordinates
    const pixelIdx = imgY * imageData.value.width + imgX
    const mask = getMaskAtPixel(pixelIdx)

    if (mask) {
      // If a color is selected, fill the mask directly
      if (selectedColor.value) {
        setMaskFillColor(mask.id, selectedColor.value)
      }
      // Track clicked mask for reference (optional, for UI feedback)
      clickedMaskId.value = mask.id
    } else {
      // Clicked outside any mask, deselect
      clickedMaskId.value = null
    }
  }
}

// Color palette handling - just store the selected color
const handleColorSelect = (color: string) => {
  selectedColor.value = color
}

// Get the name of currently selected mask for filling
const selectedMaskForFill = computed(() => {
  if (!clickedMaskId.value) return null
  return masks.value.get(clickedMaskId.value) || null
})

const selectedMaskName = computed(() => {
  return selectedMaskForFill.value?.name || ''
})

// Canvas lock state
const canvasLocked = ref(false)

const toggleCanvasLock = () => {
  canvasLocked.value = !canvasLocked.value
}

// Zoom controls
const zoomIn = () => {
  scale.value = Math.min(scale.value * 1.2, 5)
}

const zoomOut = () => {
  scale.value = Math.max(scale.value / 1.2, 0.1)
}

const resetZoom = () => {
  if (imageData.value) {
    setImageSize(imageData.value.width, imageData.value.height)
    if (containerRef.value) {
      updateContainerSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
    }
  }
}

// Container ref
const containerRef = ref<HTMLDivElement | null>(null)

// Track scale when starting to create a mask (in segment mode)
const segmentStartScale = ref<number | null>(null)

// Watch for scale changes in segment mode
watch(scale, (newScale) => {
  if (mode.value === 'segment' && activeMaskId.value && segmentStartScale.value !== null) {
    // If scale changed significantly, cancel current mask selection
    const scaleDiff = Math.abs(newScale - segmentStartScale.value)
    if (scaleDiff > 0.01) {
      // Scale changed, finish current mask
      setActiveMask(null)
      segmentStartScale.value = null
    }
  }
})

// Watch for mode changes
watch(mode, (newMode) => {
  if (newMode === 'segment') {
    // Reset scale tracking when entering segment mode
    segmentStartScale.value = null
  } else if (newMode === 'fill') {
    // Deselect any active mask
    setActiveMask(null)
    // Clear clicked mask reference
    clickedMaskId.value = null
    // Note: selectedColor is preserved so user can continue with same color

    // Rebuild merged mask matrix for optimized rendering
    rebuildMatrix()
  }
})

// Handle mask selection from panel (for renaming)
const handleMaskSelect = (id: string) => {
  setActiveMask(id)
}

// Handle mask deletion
const handleMaskDelete = (id: string) => {
  deleteMask(id)
}

// Handle mask rename
const handleMaskRename = (id: string, name: string) => {
  renameMask(id, name)
}

// Handle mask visibility toggle
const handleMaskToggleVisibility = (id: string) => {
  toggleMaskVisibility(id)
}

// Handle clear all masks
const handleClearAllMasks = () => {
  if (confirm('确定要清除所有掩码吗？')) {
    clearAllMasks()
  }
}

// Handle finish current mask (deselect to start a new one)
const handleFinishCurrentMask = () => {
  setActiveMask(null)
}

// Global drag and drop prevention to stop browser from opening files in new tabs
const preventGlobalDrag = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

const handleGlobalDrop = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

// Register global listeners on mount
onMounted(() => {
  document.addEventListener('dragover', preventGlobalDrag)
  document.addEventListener('drop', handleGlobalDrop)
})

// Clean up listeners on unmount
onUnmounted(() => {
  document.removeEventListener('dragover', preventGlobalDrag)
  document.removeEventListener('drop', handleGlobalDrop)
})
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>素描上色工具</h1>
      <div class="header-actions">
        <button class="btn-import" @click="handleImportProject" :disabled="isExporting">
          📂 导入项目
        </button>
        <button class="btn-upload" @click="triggerFileInput">
          📁 上传图片
        </button>
      </div>
    </header>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      @change="handleFileSelect"
      class="file-input"
    />

    <div class="app-body">
      <!-- Left sidebar -->
      <aside class="sidebar">
        <div class="lock-section">
          <button
            :class="['btn-lock', { locked: canvasLocked }]"
            @click="toggleCanvasLock"
          >
            {{ canvasLocked ? '🔓 解锁画布' : '🔒 锁定画布' }}
          </button>
          <p v-if="!canvasLocked" class="lock-hint">
            调整完成后请锁定画布以开始上色
          </p>
        </div>

        <ModeSwitcher v-model:mode="mode" :disabled="!canvasLocked" />

        <ThresholdSlider
          v-if="mode === 'segment'"
          v-model:threshold="threshold"
        />

        <MaskPanel
          :masks="masks"
          :active-mask-id="activeMaskId"
          :show-export="mode === 'segment'"
          @select="handleMaskSelect"
          @delete="handleMaskDelete"
          @rename="handleMaskRename"
          @toggle-visibility="handleMaskToggleVisibility"
          @clear-all="handleClearAllMasks"
          @finish-current="handleFinishCurrentMask"
          @export="handleExportProject"
        />

      </aside>

      <!-- Main canvas area -->
      <main
        ref="containerRef"
        class="canvas-area"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <!-- Drag overlay -->
        <div v-if="isDraggingOver" class="drag-overlay">
          <div class="drag-content">
            <p class="drag-title">📂 释放以导入项目</p>
            <p class="drag-hint">支持拖拽包含 project.json 的文件夹</p>
          </div>
        </div>

        <ImageCanvas
          v-if="imageData"
          :mode="mode"
          :image-data="imageData"
          :masks="masks"
          :active-mask-id="activeMaskId"
          :scale="scale"
          :offset="offset"
          :threshold="threshold"
          :locked="canvasLocked"
          :merged-mask-matrix="mergedMaskMatrix"
          :mask-id-to-number="maskIdToNumber"
          @pixel-click="handleCanvasClick"
          @update:scale="scale = $event"
          @update:offset="offset = $event"
        />

        <div v-else class="empty-canvas" :class="{ 'drag-active': isDraggingOver }">
          <p>点击左上角「上传图片」开始</p>
          <p class="hint">支持 JPG, PNG 等常见格式</p>
          <p class="hint">或拖拽项目文件夹到此处导入</p>
        </div>

        <!-- Zoom controls -->
        <div v-if="imageData" class="zoom-controls">
          <button @click="zoomOut" title="缩小" :disabled="canvasLocked">−</button>
          <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
          <button @click="zoomIn" title="放大" :disabled="canvasLocked">+</button>
          <button @click="resetZoom" title="重置" :disabled="canvasLocked">⟲</button>
        </div>
      </main>

      <!-- Right side color palette -->
      <ColorPalette
        v-if="mode === 'fill'"
        v-model:collapsed="isPaletteCollapsed"
        :selected-color="selectedColor"
        @select="handleColorSelect"
      />
    </div>
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: #fff;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #2a2a2a;
  border-bottom: 1px solid #333;
}

.app-header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.btn-upload {
  background: #4a90d9;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-upload:hover {
  background: #6ab0f9;
}

.btn-import {
  background: #27ae60;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.btn-import:hover {
  background: #2ecc71;
}

.btn-import:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-input {
  display: none;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 280px;
  padding: 16px;
  background: #222;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.empty-canvas {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #888;
}

.empty-canvas .hint {
  font-size: 12px;
  margin-top: 8px;
}

.zoom-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2a2a2a;
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.zoom-controls button {
  width: 32px;
  height: 32px;
  background: #444;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.zoom-controls button:hover {
  background: #555;
}

.zoom-level {
  min-width: 50px;
  text-align: center;
  font-size: 13px;
  color: #ccc;
}

.zoom-controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lock-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-lock {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  background: #4a90d9;
  color: white;
}

.btn-lock:hover {
  background: #6ab0f9;
}

.btn-lock.locked {
  background: #e74c3c;
}

.btn-lock.locked:hover {
  background: #c0392b;
}

.lock-hint {
  margin: 0;
  font-size: 12px;
  color: #888;
  text-align: center;
}

/* Drag and drop overlay */
.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(74, 144, 217, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border: 4px dashed #fff;
}

.drag-content {
  text-align: center;
  color: #fff;
}

.drag-title {
  font-size: 24px;
  font-weight: 500;
  margin: 0 0 8px 0;
}

.drag-hint {
  font-size: 14px;
  margin: 0;
  opacity: 0.9;
}

.empty-canvas.drag-active {
  background: rgba(74, 144, 217, 0.2);
  border: 4px dashed #4a90d9;
}
</style>
