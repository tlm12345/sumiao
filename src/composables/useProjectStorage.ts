import { ref } from 'vue'
import type { Mask, RowMask, MaskBounds, LegacyMask } from '@/types'
import { decodeMaskPixels, countMaskPixels, calculateMaskBounds, encodeMaskPixels } from '@/utils/maskEncoding'

// 项目数据 v2.0 格式
export interface ProjectDataV2 {
  version: '2.0'
  imageWidth: number
  imageHeight: number
  masks: Array<{
    id: string
    name: string
    rows: RowMask[]
    bounds: MaskBounds
    fillColor: string | null
    visible: boolean
    createdAtScale: number
  }>
}

// 兼容旧版本 v1.0
export interface ProjectDataV1 {
  version?: '1.0'
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

export type ProjectData = ProjectDataV2 | ProjectDataV1

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
   * base64 转 Uint8Array
   */
  function base64ToUint8Array(base64: string): Uint8Array {
    const base64Parts = base64.split(',')
    const base64Data = base64Parts[1] ?? base64Parts[0]
    if (!base64Data) throw new Error('无效的图像数据')

    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    return new Uint8Array(byteNumbers)
  }

  /**
   * 导出项目到本地文件夹
   * 项目结构：
   *   project-name/
   *     project.json      # 掩码信息（v2.0格式）
   *     original/         # 原始图像文件夹
   *       image.png       # 原始图像
   *
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
      // 构建项目数据 v2.0
      const projectData: ProjectDataV2 = {
        version: '2.0',
        imageWidth: imageData.width,
        imageHeight: imageData.height,
        masks: Array.from(masks.values()).map(mask => ({
          id: mask.id,
          name: mask.name,
          rows: mask.rows,
          bounds: mask.bounds,
          fillColor: mask.fillColor,
          visible: mask.visible,
          createdAtScale: mask.createdAtScale
        }))
      }

      // 准备图像数据
      const imageBase64 = imageDataToBase64(imageData)
      const imageBytes = base64ToUint8Array(imageBase64)
      const imageBlob = new Blob([imageBytes as unknown as BlobPart], { type: 'image/png' })

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

          // 创建 original 文件夹并保存图像
          const originalDirHandle = await projectDirHandle.getDirectoryHandle('original', { create: true })
          const imageHandle = await originalDirHandle.getFileHandle('image.png', { create: true })
          const imageWritable = await imageHandle.createWritable()
          await imageWritable.write(imageBlob)
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

      // 传统下载方式：打包为 zip（简化版：分别下载文件）
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
      imageLink.href = imageBase64
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
   * 检查是否支持 File System Access API 的文件夹选择功能
   */
  function isFileSystemAccessSupported(): boolean {
    const isSecureContext = window.isSecureContext
    const hasDirectoryPicker = 'showDirectoryPicker' in window

    console.log('File System Access API 检测:', {
      isSecureContext,
      hasDirectoryPicker,
      protocol: window.location.protocol,
      hostname: window.location.hostname
    })

    return isSecureContext && hasDirectoryPicker
  }

  /**
   * 从 v1.0 格式转换为 v2.0 格式
   */
  function convertV1ToV2(projectData: ProjectDataV1): ProjectDataV2 {
    const { imageWidth, imageHeight } = projectData

    return {
      version: '2.0',
      imageWidth,
      imageHeight,
      masks: projectData.masks.map(oldMask => {
        const pixels = new Set(oldMask.pixels)
        const rows = encodeMaskPixels(pixels, imageWidth, imageHeight)
        const bounds = calculateMaskBounds(rows, imageWidth)

        return {
          id: oldMask.id,
          name: oldMask.name,
          rows,
          bounds: bounds || { minX: 0, maxX: 0, minY: 0, maxY: 0 },
          fillColor: oldMask.fillColor,
          visible: oldMask.visible,
          createdAtScale: oldMask.createdAtScale
        }
      })
    }
  }

  /**
   * 解析项目数据，支持 v1.0 和 v2.0 格式
   */
  async function parseProjectData(projectData: ProjectData): Promise<{ masks: Map<string, Mask>, width: number, height: number }> {
    // 检测版本并转换
    let data: ProjectDataV2

    if (!projectData.version || projectData.version === '1.0') {
      console.log('[useProjectStorage] Converting project from v1.0 to v2.0')
      data = convertV1ToV2(projectData as ProjectDataV1)
    } else {
      data = projectData as ProjectDataV2
    }

    // 恢复掩码数据
    const masks = new Map<string, Mask>()

    for (const maskData of data.masks) {
      const mask: Mask = {
        id: maskData.id,
        name: maskData.name,
        rows: maskData.rows,
        bounds: maskData.bounds,
        fillColor: maskData.fillColor,
        visible: maskData.visible,
        createdAtScale: maskData.createdAtScale,
        pixelCount: countMaskPixels(maskData.rows)
      }
      masks.set(mask.id, mask)
    }

    return {
      masks,
      width: data.imageWidth,
      height: data.imageHeight
    }
  }

  /**
   * 从 File System Access API 的目录句柄中读取项目
   * 优先从 original/ 文件夹读取图像
   */
  async function readProjectFromDirectoryHandle(dirHandle: FileSystemDirectoryHandle): Promise<ImportResult> {
    // 读取 project.json
    let projectData: ProjectData
    try {
      const jsonHandle = await dirHandle.getFileHandle('project.json')
      const jsonFile = await jsonHandle.getFile()
      const jsonText = await jsonFile.text()
      projectData = JSON.parse(jsonText)
    } catch {
      throw new Error('文件夹中未找到 project.json')
    }

    // 解析掩码数据
    const { masks, width, height } = await parseProjectData(projectData)

    // 优先从 original/ 文件夹读取图像
    let imageData: ImageData
    try {
      const originalDirHandle = await dirHandle.getDirectoryHandle('original')
      const imageHandle = await originalDirHandle.getFileHandle('image.png')
      const imageFile = await imageHandle.getFile()
      imageData = await fileToImageData(imageFile)
      console.log('[useProjectStorage] Loaded image from original/image.png')
    } catch {
      // 如果 original/ 文件夹不存在，尝试从 imageBase64 读取（v1.0兼容）
      if ('imageBase64' in projectData && projectData.imageBase64) {
        imageData = await base64ToImageData(projectData.imageBase64)
        console.log('[useProjectStorage] Loaded image from imageBase64 (v1.0 format)')
      } else {
        throw new Error('项目中未找到图像（需要 original/image.png 或 imageBase64）')
      }
    }

    // 验证图像尺寸
    if (imageData.width !== width || imageData.height !== height) {
      console.warn(`[useProjectStorage] Image size mismatch: expected ${width}x${height}, got ${imageData.width}x${imageData.height}`)
    }

    // 重建反向索引
    const pixelToMask = new Map<number, string>()
    for (const [id, mask] of masks) {
      for (const pixelIdx of decodeMaskPixels(mask.rows, imageData.width)) {
        pixelToMask.set(pixelIdx, id)
      }
    }

    return { imageData, masks, pixelToMask }
  }

  /**
   * 从本地文件夹导入项目
   * 优先使用 File System Access API，否则使用 webkitdirectory 属性
   */
  async function importProject(): Promise<ImportResult | null> {
    isImporting.value = true
    lastError.value = null

    try {
      // 方式1：使用 File System Access API（现代浏览器，需要 HTTPS）
      if (isFileSystemAccessSupported()) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker()
          const result = await readProjectFromDirectoryHandle(dirHandle)
          return result
        } catch (err: any) {
          if (err.name === 'AbortError') {
            return null
          }
          console.warn('File System Access API 调用失败，尝试备选方案:', err)
        }
      }

      // 方式2：使用 webkitdirectory 属性（Chrome/Edge 支持，不需要 HTTPS）
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        ;(input as any).webkitdirectory = true
        ;(input as any).directory = true

        input.onchange = async (e) => {
          const files = (e.target as HTMLInputElement).files
          if (!files || files.length === 0) {
            resolve(null)
            return
          }

          try {
            resolve(await importFromFiles(Array.from(files)))
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
   * 从文件列表中导入项目
   */
  async function importFromFiles(files: File[]): Promise<ImportResult | null> {
    if (!files || files.length === 0) return null

    // 查找 project.json
    let jsonFile: File | null = null
    let originalImageFile: File | null = null

    for (const file of files) {
      const fileName = file.name.split('/').pop()?.split('\\').pop() || file.name

      if (fileName === 'project.json') {
        jsonFile = file
      }
      if (fileName === 'image.png') {
        // 优先使用 original/ 下的 image.png
        if (file.webkitRelativePath?.includes('original/')) {
          originalImageFile = file
        } else if (!originalImageFile) {
          originalImageFile = file
        }
      }
    }

    if (!jsonFile) {
      throw new Error('文件夹中未找到 project.json')
    }

    // 读取项目数据
    const text = await jsonFile.text()
    const projectData: ProjectData = JSON.parse(text)
    const { masks, width, height } = await parseProjectData(projectData)

    // 读取图像
    let imageData: ImageData
    if (originalImageFile) {
      imageData = await fileToImageData(originalImageFile)
    } else if ('imageBase64' in projectData && projectData.imageBase64) {
      imageData = await base64ToImageData(projectData.imageBase64)
    } else {
      throw new Error('项目中未找到图像（需要 original/image.png 或 imageBase64）')
    }

    // 重建反向索引
    const pixelToMask = new Map<number, string>()
    for (const [id, mask] of masks) {
      for (const pixelIdx of decodeMaskPixels(mask.rows, imageData.width)) {
        pixelToMask.set(pixelIdx, id)
      }
    }

    return { imageData, masks, pixelToMask }
  }

  /**
   * 递归读取文件夹中的所有文件
   */
  async function readDirectoryRecursive(dirEntry: FileSystemDirectoryEntry): Promise<File[]> {
    const files: File[] = []

    const readEntries = async (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
      return new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject)
      })
    }

    const getFile = async (fileEntry: FileSystemFileEntry): Promise<File> => {
      return new Promise((resolve, reject) => {
        fileEntry.file(resolve, reject)
      })
    }

    const traverse = async (entry: FileSystemEntry): Promise<void> => {
      if (entry.isFile) {
        const file = await getFile(entry as FileSystemFileEntry)
        files.push(file)
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader()
        let entries = await readEntries(reader)
        while (entries.length > 0) {
          for (const childEntry of entries) {
            await traverse(childEntry)
          }
          entries = await readEntries(reader)
        }
      }
    }

    await traverse(dirEntry)
    return files
  }

  /**
   * 从拖拽的数据传输项中导入项目
   * 支持拖拽文件夹（使用 webkitdirectory API）
   */
  async function importFromDrop(dataTransfer: DataTransfer): Promise<ImportResult | null> {
    isImporting.value = true
    lastError.value = null

    try {
      const items = dataTransfer.items

      // 方法1: 使用 webkitGetAsEntry API（支持文件夹拖拽）
      if (items && items.length > 0) {
        for (const item of Array.from(items)) {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null

          if (entry) {
            if (entry.isDirectory) {
              const files = await readDirectoryRecursive(entry as FileSystemDirectoryEntry)
              return await importFromFiles(files)
            } else if (entry.isFile) {
              const file = await new Promise<File>((resolve, reject) => {
                (entry as FileSystemFileEntry).file(resolve, reject)
              })

              if (file.name.endsWith('.json')) {
                const text = await file.text()
                const projectData: ProjectData = JSON.parse(text)

                // 如果是单文件导入，尝试从同名文件夹找图像
                // 这里简化处理，仅支持 JSON 中的 imageBase64
                const { masks, width, height } = await parseProjectData(projectData)

                let imageData: ImageData
                if ('imageBase64' in projectData && projectData.imageBase64) {
                  imageData = await base64ToImageData(projectData.imageBase64)
                } else {
                  throw new Error('JSON 文件中未找到图像数据')
                }

                const pixelToMask = new Map<number, string>()
                for (const [id, mask] of masks) {
                  for (const pixelIdx of decodeMaskPixels(mask.rows, imageData.width)) {
                    pixelToMask.set(pixelIdx, id)
                  }
                }

                return { imageData, masks, pixelToMask }
              } else if (file.type.startsWith('image/') || file.name.endsWith('.png') || file.name.endsWith('.jpg')) {
                const imageData = await fileToImageData(file)
                return {
                  imageData,
                  masks: new Map(),
                  pixelToMask: new Map()
                }
              }
            }
          }
        }
      }

      // 方法2：回退到 dataTransfer.files
      const files = dataTransfer.files
      if (files && files.length > 0) {
        const fileArray = Array.from(files)
        return await importFromFiles(fileArray)
      }

      return null
    } catch (err: any) {
      lastError.value = err.message || '导入失败'
      console.error('拖拽导入失败:', err)
      return null
    } finally {
      isImporting.value = false
    }
  }

  return {
    isImporting,
    isExporting,
    lastError,
    isFileSystemAccessSupported,
    exportProject,
    importProject,
    importFromDrop
  }
}
