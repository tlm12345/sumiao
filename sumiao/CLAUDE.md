# 素描上色应用 (Sumiao)

## 项目信息
- **技术栈**: Vue 3 + TypeScript + Vite
- **项目路径**: `G:\Project\sumiao\sumiao`

## 开发指令

### 启动开发服务器
```bash
cd G:\Project\sumiao\sumiao && npm run dev
```

### 构建
```bash
npm run build
```

## 应用功能

### 阶段一：分割模式
- 上传并显示素描图像
- 使用魔棒工具（Flood Fill）点击选择相似颜色区域
- 调整阈值控制选择范围
- 为选中的掩码命名
- 管理多个掩码（添加、删除、显示/隐藏）

### 阶段二：填充模式
- 点击图像检测所属掩码
- 弹出调色板选择颜色
- 调色板包含 Light/Dark 两类颜色
- 支持多个区域同时显示不同填充色

## 核心组件

| 组件 | 路径 | 功能 |
|------|------|------|
| ImageCanvas | `src/components/ImageCanvas.vue` | 主画布，图像渲染、缩放、点击交互 |
| MaskPanel | `src/components/MaskPanel.vue` | 掩码列表管理 |
| ColorPalette | `src/components/ColorPalette.vue` | 调色板弹窗 |
| ModeSwitcher | `src/components/ModeSwitcher.vue` | 模式切换控件 |
| ThresholdSlider | `src/components/ThresholdSlider.vue` | 魔棒阈值滑块 |

## Composables

| Composable | 路径 | 功能 |
|------------|------|------|
| useFloodFill | `src/composables/useFloodFill.ts` | 魔棒算法（BFS Flood Fill） |
| useImageScale | `src/composables/useImageScale.ts` | 图像缩放和坐标转换 |
| useMasks | `src/composables/useMasks.ts` | 掩码状态管理 |

## 调色板颜色

### Light
- pink: #FFB6C1, yellow: #FFFFE0, green: #90EE90
- blue: #ADD8E6, red: #FFA07A, purple: #DDA0DD
- gray: #D3D3D3, orange: #FFDAB9, brown: #D2B48C
- white: #FFFFFF

### Dark
- pink: #C71585, yellow: #FFD700, green: #228B22
- blue: #0000CD, red: #8B0000, purple: #800080
- gray: #696969, orange: #FF8C00, brown: #8B4513
- black: #000000

## 关键数据结构

```typescript
interface Mask {
  id: string
  name: string
  pixels: Set<number>  // 扁平化像素索引 (y * width + x)
  fillColor: string | null
  visible: boolean
}
```

## 注意事项

1. **坐标转换**: 所有点击事件的屏幕坐标必须转换为原始图像坐标
2. **缩放处理**: 掩码基于原始图像尺寸，渲染时按当前缩放比例绘制
3. **性能**: 使用 Set 存储像素索引，Map 建立像素到掩码的反向索引
4. **图像自适应**: 图片应自适应容器，用户无需滚动查看完整图像
