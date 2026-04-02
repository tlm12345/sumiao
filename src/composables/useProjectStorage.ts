import { ref } from 'vue'
import type { Mask, Mode } from '@/types'

export interface ProjectData {
  version: string
  imageWidth: number
  imageHeight: number
  imageBase64: string
  masks: Array<{
    id: string
    name: string
    pixels: number[]
    fillColor: string | null
    visible: boolean
    createdAtScale: number
  }>
}

export interface ImportResult {
  imageData: ImageData
  masks: Map<string, Mask>
  pixelToMask: Map<number, string>
}

export function useProjectStorage() {
  const isImporting = ref(false)
  const isExporting = ref(false)
  const lastError = ref<string | null>(null)

  /**
   * 将 ImageData 转换为 Base64 PNG
   */
  function imageDataToBase64(imageData: ImageData): string {
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 canvas 上下文')

    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
  }

  /**
   * 将 Base64 图像转换为 ImageData
   */
  async function base64ToImageData(base64: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法创建 canvas 上下文'))
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(ctx.getImageData(0, 0, img.width, img.height))
      }
      img.onerror = () => reject(new Error('图像加载失败'))
      img.src = base64
    })
  }

  /**
   * 导出项目到本地文件夹
   * 优先使用 File System Access API，否则使用传统下载方式
   */
  async function exportProject(
    imageData: ImageData,
    masks: Map<string, Mask>,
    projectName: string = 'sumiao-project'
  ): Promise<boolean> {
    isExporting.value = true
    lastError.value = null

    try {
      // 构建项目数据
      const projectData: ProjectData = {
        version: '1.0',
        imageWidth: imageData.width,
        imageHeight: imageData.height,
        imageBase64: imageDataToBase64(imageData),
        masks: Array.from(masks.values()).map(mask => ({
          id: mask.id,
          name: mask.name,
          pixels: Array.from(mask.pixels),
          fillColor: mask.fillColor,
          visible: mask.visible,
          createdAtScale: mask.createdAtScale
        }))
      }

      // 尝试使用 File System Access API
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker()
          const projectDirHandle = await dirHandle.getDirectoryHandle(projectName, { create: true })

          // 保存 project.json
          const jsonHandle = await projectDirHandle.getFileHandle('project.json', { create: true })
          const jsonWritable = await jsonHandle.createWritable()
          await jsonWritable.write(JSON.stringify(projectData, null, 2))
          await jsonWritable.close()

          // 保存原始图像
          const imageHandle = await projectDirHandle.getFileHandle('image.png', { create: true })
          const imageWritable = await imageHandle.createWritable()

          // 将 base64 转换为 blob
          const base64Parts = projectData.imageBase64.split(',')
          const base64Data = base64Parts[1] ?? base64Parts[0]
          if (!base64Data) throw new Error('无效的图像数据')
          const byteCharacters = atob(base64Data)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: 'image/png' })

          await imageWritable.write(blob)
          await imageWritable.close()

          return true
        } catch (err: any) {
          // 用户取消或 API 失败，回退到传统方式
          if (err.name === 'AbortError') {
            return false
          }
          console.warn('File System Access API 失败，使用传统下载方式:', err)
        }
      }

      // 传统下载方式：打包为 zip（简化版：分别下载两个文件）
      // 下载 project.json
      const jsonBlob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
      const jsonUrl = URL.createObjectURL(jsonBlob)
      const jsonLink = document.createElement('a')
      jsonLink.href = jsonUrl
      jsonLink.download = `${projectName}.json`
      document.body.appendChild(jsonLink)
      jsonLink.click()
      document.body.removeChild(jsonLink)
      URL.revokeObjectURL(jsonUrl)

      // 下载图像
      const imageLink = document.createElement('a')
      imageLink.href = projectData.imageBase64
      imageLink.download = `${projectName}.png`
      document.body.appendChild(imageLink)
      imageLink.click()
      document.body.removeChild(imageLink)

      return true
    } catch (err: any) {
      lastError.value = err.message || '导出失败'
      console.error('导出项目失败:', err)
      return false
    } finally {
      isExporting.value = false
    }
  }

  /**
   * 从本地文件夹导入项目
   * 优先使用 File System Access API，否则使用传统文件选择
   */
  async function importProject(): Promise<ImportResult | null> {
    isImporting.value = true
    lastError.value = null

    try {
      // 尝试使用 File System Access API
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker()

          // 读取 project.json
          let projectData: ProjectData
          try {
            const jsonHandle = await dirHandle.getFileHandle('project.json')
            const jsonFile = await jsonHandle.getFile()
            const jsonText = await jsonFile.text()
            projectData = JSON.parse(jsonText)
          } catch {
            // 如果没有 project.json，尝试从 image.png 加载（仅图像）
            try {
              const imageHandle = await dirHandle.getFileHandle('image.png')
              const imageFile = await imageHandle.getFile()
              const imageData = await fileToImageData(imageFile)
              return {
                imageData,
                masks: new Map(),
                pixelToMask: new Map()
              }
            } catch {
              throw new Error('文件夹中未找到有效的项目文件（需要 project.json 或 image.png）')
            }
          }

          // 解析项目数据
          return parseProjectData(projectData)
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return null
          }
          throw err
        }
      }

      // 传统方式：使用文件选择
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json,image/png,image/jpeg'
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) {
            resolve(null)
            return
          }

          try {
            if (file.name.endsWith('.json')) {
              const text = await file.text()
              const projectData: ProjectData = JSON.parse(text)
              const result = await parseProjectData(projectData)
              resolve(result)
            } else {
              // 图像文件
              const imageData = await fileToImageData(file)
              resolve({
                imageData,
                masks: new Map(),
                pixelToMask: new Map()
              })
            }
          } catch (err: any) {
            lastError.value = err.message || '导入失败'
            console.error('导入项目失败:', err)
            resolve(null)
          }
        }
        input.click()
      })
    } catch (err: any) {
      lastError.value = err.message || '导入失败'
      console.error('导入项目失败:', err)
      return null
    } finally {
      isImporting.value = false
    }
  }

  /**
   * 将 File 对象转换为 ImageData
   */
  async function fileToImageData(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              reject(new Error('无法创建 canvas 上下文'))
              return
            }
            ctx.drawImage(img, 0, 0)
            resolve(ctx.getImageData(0, 0, img.width, img.height))
          }
          img.onerror = () => reject(new Error('图像加载失败'))
          img.src = e.target?.result as string
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * 解析项目数据
   */
  async function parseProjectData(projectData: ProjectData): Promise<ImportResult> {
    // 版本检查
    if (!projectData.version) {
      console.warn('项目数据缺少版本号，可能来自旧版本')
    }

    // 恢复图像数据
    const imageData = await base64ToImageData(projectData.imageBase64)

    // 恢复掩码数据
    const masks = new Map<string, Mask>()
    const pixelToMask = new Map<number, string>()

    for (const maskData of projectData.masks) {
      const mask: Mask = {
        id: maskData.id,
        name: maskData.name,
        pixels: new Set(maskData.pixels),
        fillColor: maskData.fillColor,
        visible: maskData.visible,
        createdAtScale: maskData.createdAtScale
      }
      masks.set(mask.id, mask)

      // 重建反向索引
      for (const pixelIdx of mask.pixels) {
        pixelToMask.set(pixelIdx, mask.id)
      }
    }

    return { imageData, masks, pixelToMask }
  }

  return {
    isImporting,
    isExporting,
    lastError,
    exportProject,
    importProject
  }
}
