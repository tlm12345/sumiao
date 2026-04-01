<script setup lang="ts">
import { ref } from 'vue'
import type { Mask } from '@/types'

const props = defineProps<{
  masks: Map<string, Mask>
  activeMaskId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
  (e: 'rename', id: string, name: string): void
  (e: 'toggleVisibility', id: string): void
  (e: 'clearAll'): void
  (e: 'finishCurrent'): void
}>()

const maskList = () => Array.from(props.masks.values())
const editingId = ref<string | null>(null)
const editingName = ref('')

const startRename = (mask: Mask) => {
  editingId.value = mask.id
  editingName.value = mask.name
}

const confirmRename = () => {
  if (editingId.value && editingName.value.trim()) {
    emit('rename', editingId.value, editingName.value.trim())
  }
  editingId.value = null
  editingName.value = ''
}

const cancelRename = () => {
  editingId.value = null
  editingName.value = ''
}
</script>

<template>
  <div class="mask-panel">
    <div class="panel-header">
      <h3>掩码列表 ({{ masks.size }})</h3>
      <button v-if="masks.size > 0" class="btn-clear" @click="emit('clearAll')">
        清除全部
      </button>
    </div>

    <div v-if="activeMaskId" class="active-mask-notice">
      <p>正在编辑: {{ masks.get(activeMaskId)?.name }}</p>
      <button class="btn-finish" @click="emit('finishCurrent')">
        ✓ 完成此掩码
      </button>
    </div>

    <div v-if="masks.size === 0" class="empty-state">
      <p>暂无掩码</p>
      <p class="hint">在分割模式下点击图片创建掩码</p>
    </div>

    <ul class="mask-list">
      <li
        v-for="mask in maskList()"
        :key="mask.id"
        :class="['mask-item', { active: mask.id === activeMaskId }]"
        @click="emit('select', mask.id)"
      >
        <button
          class="visibility-btn"
          @click.stop="emit('toggleVisibility', mask.id)"
        >
          {{ mask.visible ? '👁' : '🚫' }}
        </button>

        <div class="mask-info">
          <div v-if="editingId === mask.id" class="rename-form">
            <input
              v-model="editingName"
              type="text"
              @keyup.enter="confirmRename"
              @keyup.esc="cancelRename"
              @blur="confirmRename"
              ref="editInput"
            />
          </div>
          <span v-else class="mask-name" @dblclick.stop="startRename(mask)">
            {{ mask.name }}
          </span>
          <span class="pixel-count">{{ mask.pixels.size.toLocaleString() }} 像素</span>
        </div>

        <div
          v-if="mask.fillColor"
          class="color-preview"
          :style="{ backgroundColor: mask.fillColor }"
        />

        <button class="delete-btn" @click.stop="emit('delete', mask.id)">
          🗑️
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mask-panel {
  background: #2a2a2a;
  border-radius: 8px;
  padding: 16px;
  color: #fff;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
}

.btn-clear {
  background: #ff4444;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-clear:hover {
  background: #ff6666;
}

.active-mask-notice {
  background: #4a90d9;
  padding: 10px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

.active-mask-notice p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #fff;
}

.btn-finish {
  width: 100%;
  background: #2ecc71;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}

.btn-finish:hover {
  background: #27ae60;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #888;
}

.empty-state .hint {
  font-size: 12px;
  margin-top: 8px;
}

.mask-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}

.mask-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 4px;
  background: #333;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.mask-item:hover {
  background: #444;
}

.mask-item.active {
  background: #4a90d9;
}

.visibility-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-right: 8px;
  font-size: 14px;
}

.mask-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mask-name {
  font-size: 13px;
  font-weight: 500;
}

.pixel-count {
  font-size: 11px;
  color: #888;
}

.rename-form input {
  background: #444;
  border: 1px solid #666;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
  width: 100%;
}

.color-preview {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  margin: 0 8px;
  border: 1px solid #555;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.delete-btn:hover {
  opacity: 1;
}
</style>
