<script setup lang="ts">
const props = defineProps<{
  threshold: number
}>()

const emit = defineEmits<{
  (e: 'update:threshold', value: number): void
}>()

const handleInput = (e: Event) => {
  const value = parseInt((e.target as HTMLInputElement).value)
  emit('update:threshold', value)
}
</script>

<template>
  <div class="threshold-slider">
    <div class="slider-header">
      <label>魔棒阈值</label>
      <span class="threshold-value">{{ threshold }}</span>
    </div>
    <input
      type="range"
      :value="threshold"
      min="5"
      max="100"
      @input="handleInput"
      class="slider"
    />
    <div class="slider-hints">
      <span>精确</span>
      <span>宽松</span>
    </div>
  </div>
</template>

<style scoped>
.threshold-slider {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 12px 16px;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.slider-header label {
  color: #fff;
  font-size: 13px;
}

.threshold-value {
  background: #444;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  min-width: 32px;
  text-align: center;
}

.slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #444;
  border-radius: 3px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #4a90d9;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
}

.slider::-webkit-slider-thumb:hover {
  background: #6ab0f9;
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #4a90d9;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.slider-hints {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: #888;
}
</style>
