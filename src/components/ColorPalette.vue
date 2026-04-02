<script setup lang="ts">
import { computed } from 'vue'
import { PALETTE } from '@/utils/color'

const props = defineProps<{
  collapsed?: boolean
  selectedColor?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void
  (e: 'select', color: string): void
}>()

const isCollapsed = computed({
  get: () => props.collapsed ?? false,
  set: (value) => emit('update:collapsed', value)
})

const currentSelectedColor = computed(() => props.selectedColor)

const handleToggle = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleColorClick = (color: string) => {
  emit('select', color)
}

const isColorSelected = (color: string) => {
  return currentSelectedColor.value === color
}
</script>

<template>
  <div class="color-palette-wrapper" :class="{ collapsed: isCollapsed }">
    <button
      class="toggle-btn"
      :title="isCollapsed ? '展开调色板' : '收起调色板'"
      @click="handleToggle"
    >
      <span class="arrow">{{ isCollapsed ? '◀' : '▶' }}</span>
    </button>

    <div class="color-palette-panel">
      <div class="palette-header">
        <h3>调色板</h3>
        <span v-if="currentSelectedColor" class="selected-hint">
          点击掩码区域填充颜色
        </span>
        <span v-else class="hint">先选择颜色，再点击掩码</span>
      </div>

      <div class="palette-columns">
        <!-- Light Column -->
        <div class="color-column">
          <h4>{{ PALETTE.light.name }}</h4>
          <div class="color-grid">
            <button
              v-for="color in PALETTE.light.colors"
              :key="`light-${color.name}`"
              class="color-circle"
              :class="{ selected: isColorSelected(color.value) }"
              :style="{ backgroundColor: color.value, '--glow-color': color.value }"
              :title="color.name"
              @click="handleColorClick(color.value)"
            />
          </div>
        </div>

        <!-- Dark Column -->
        <div class="color-column">
          <h4>{{ PALETTE.dark.name }}</h4>
          <div class="color-grid">
            <button
              v-for="color in PALETTE.dark.colors"
              :key="`dark-${color.name}`"
              class="color-circle"
              :class="{ selected: isColorSelected(color.value) }"
              :style="{ backgroundColor: color.value, '--glow-color': color.value }"
              :title="color.name"
              @click="handleColorClick(color.value)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-palette-wrapper {
  position: relative;
  display: flex;
  align-items: stretch;
  background: #2a2a2a;
  transition: transform 0.3s ease;
  z-index: 50;
}

.color-palette-wrapper.collapsed {
  transform: translateX(calc(100% - 30px));
}

.toggle-btn {
  position: absolute;
  left: -30px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 60px;
  background: #2a2a2a;
  border: none;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  transition: background 0.2s;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3);
}

.toggle-btn:hover {
  background: #3a3a3a;
}

.arrow {
  display: block;
  transition: transform 0.2s;
}

.color-palette-panel {
  width: 220px;
  padding: 16px;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.palette-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #444;
}

.palette-header h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
}

.selected-hint {
  font-size: 12px;
  color: #4a90d9;
  animation: pulse-text 2s ease-in-out infinite;
}

.hint {
  font-size: 12px;
  color: #888;
}

@keyframes pulse-text {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.palette-columns {
  display: flex;
  gap: 12px;
  flex: 1;
}

.color-column {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.color-column h4 {
  margin: 0 0 12px 0;
  font-size: 11px;
  color: #aaa;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.color-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.color-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  position: relative;
}

.color-circle:hover {
  transform: scale(1.1);
  border-color: #fff;
}

/* 立体光效 - 选中状态 */
.color-circle.selected {
  transform: scale(1.15);
  border-color: #fff;
  box-shadow:
    0 0 10px var(--glow-color),
    0 0 20px var(--glow-color),
    0 0 30px var(--glow-color),
    inset 0 0 10px rgba(255, 255, 255, 0.3);
  animation: pulse-glow 1.5s ease-in-out infinite;
  z-index: 10;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow:
      0 0 10px var(--glow-color),
      0 0 20px var(--glow-color),
      0 0 30px var(--glow-color),
      inset 0 0 10px rgba(255, 255, 255, 0.3);
  }
  50% {
    box-shadow:
      0 0 15px var(--glow-color),
      0 0 30px var(--glow-color),
      0 0 45px var(--glow-color),
      inset 0 0 15px rgba(255, 255, 255, 0.5);
  }
}

/* 收缩状态下隐藏面板内容 */
.collapsed .color-palette-panel {
  opacity: 0;
  pointer-events: none;
}
</style>
