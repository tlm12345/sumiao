<script setup lang="ts">
import { PALETTE } from '@/utils/color'

const props = defineProps<{
  visible: boolean
  selectedMaskId: string | null
  selectedMaskName: string
}>()

const emit = defineEmits<{
  (e: 'select', color: string): void
}>()

const handleColorClick = (color: string) => {
  if (props.selectedMaskId) {
    emit('select', color)
  }
}
</script>

<template>
  <div v-if="visible" class="color-palette-panel">
    <div class="palette-header">
      <h3>填充颜色</h3>
      <span v-if="selectedMaskName" class="selected-mask">
        为 "{{ selectedMaskName }}" 选择颜色
      </span>
      <span v-else class="hint">点击掩码区域选择颜色</span>
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
            :style="{ backgroundColor: color.value }"
            :title="color.name"
            :disabled="!selectedMaskId"
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
            :style="{ backgroundColor: color.value }"
            :title="color.name"
            :disabled="!selectedMaskId"
            @click="handleColorClick(color.value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-palette-panel {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 16px;
  color: #fff;
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

.selected-mask {
  font-size: 12px;
  color: #4a90d9;
}

.hint {
  font-size: 12px;
  color: #888;
}

.palette-columns {
  display: flex;
  gap: 16px;
}

.color-column {
  flex: 1;
}

.color-column h4 {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #aaa;
  text-align: center;
  text-transform: uppercase;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.color-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.color-circle:hover:not(:disabled) {
  transform: scale(1.1);
  border-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.color-circle:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
