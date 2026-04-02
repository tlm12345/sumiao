<script setup lang="ts">
import type { Mode } from '@/types'

const props = defineProps<{
  mode: Mode
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:mode', mode: Mode): void
}>()

const modes: { value: Mode; label: string; icon: string; description: string }[] = [
  { value: 'segment', label: '分割模式', icon: '✂️', description: '点击图片创建区域掩码' },
  { value: 'fill', label: '填充模式', icon: '🎨', description: '点击掩码填充颜色' }
]
</script>

<template>
  <div class="mode-switcher">
    <button
      v-for="m in modes"
      :key="m.value"
      :class="['mode-btn', { active: mode === m.value, disabled: disabled }]"
      :disabled="disabled"
      @click="emit('update:mode', m.value)"
    >
      <span class="mode-icon">{{ m.icon }}</span>
      <span class="mode-label">{{ m.label }}</span>
      <span class="mode-desc">{{ m.description }}</span>
    </button>
  </div>
</template>

<style scoped>
.mode-switcher {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 8px;
}

.mode-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
  background: #333;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover:not(:disabled) {
  background: #444;
}

.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mode-btn.active {
  background: #4a90d9;
  border-color: #6ab0f9;
}

.mode-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.mode-label {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.mode-desc {
  color: #888;
  font-size: 11px;
  margin-top: 2px;
}

.mode-btn.active .mode-desc {
  color: #ccc;
}
</style>
