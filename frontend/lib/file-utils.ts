// 文件类型工具函数 - 与后端 Django 模型匹配

export interface FileInfo {
  type: 'image' | 'video'  // 只支持后端定义的两种类型
  icon: string
  displayName: string
  extensions: string[]
  mimeTypes: string[]
}

export const FILE_TYPES: Record<string, FileInfo> = {
  // 图片类型 - 匹配后端支持的格式
  image: {
    type: 'image',
    icon: 'image',
    displayName: '图片',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      'image/svg+xml' // 虽然后端不明确支持，但常见
    ]
  },

  // 视频类型 - 匹配后端支持的格式
  video: {
    type: 'video',
    icon: 'video',
    displayName: '视频',
    extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
    mimeTypes: [
      'video/mp4',
      'video/avi',
      'video/quicktime',
      'video/x-ms-wmv',
      'video/x-flv',
      'video/webm',
      'video/ogg'
    ]
  }
}

// 获取文件信息 - 根据后端 file_type 字段或 MIME 类型
export function getFileInfo(input: string): FileInfo {
  // 首先检查是否是后端的 file_type 值 ('image' 或 'video')
  if (input === 'image' || input === 'video') {
    return FILE_TYPES[input]
  }

  // 如果是 MIME 类型，查找匹配的类型
  for (const [type, info] of Object.entries(FILE_TYPES)) {
    if (info.mimeTypes.includes(input)) {
      return info
    }
  }

  // 未找到匹配，返回默认的图片类型（或者可以抛出错误）
  return FILE_TYPES.image
}

// 从文件名推断后端 file_type
export function guessFileTypeFromFileName(fileName: string): 'image' | 'video' {
  const extension = fileName.split('.').pop()?.toLowerCase()

  // 后端支持的图片扩展名
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']

  // 后端支持的视频扩展名
  const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm']

  if (imageExtensions.includes(extension || '')) {
    return 'image'
  } else if (videoExtensions.includes(extension || '')) {
    return 'video'
  } else {
    // 默认返回图片，或者可以抛出错误
    throw new Error('不支持的文件类型')
  }
}

// 从文件名推断MIME类型（为了兼容性保留）
export function guessMimeTypeFromFileName(fileName: string): string {
  const fileType = guessFileTypeFromFileName(fileName)

  if (fileType === 'image') {
    return 'image/jpeg' // 默认图片 MIME 类型
  } else {
    return 'video/mp4' // 默认视频 MIME 类型
  }
}

// 检查文件类型是否支持预览
export function isPreviewable(fileType: string): boolean {
  const info = getFileInfo(fileType)
  return info.type === 'image' || info.type === 'video'
}

// 检查文件类型是否支持上传（与后端验证逻辑匹配）
export function isUploadable(input: string): boolean {
  try {
    // 如果是文件名，检查扩展名
    if (input.includes('.')) {
      guessFileTypeFromFileName(input)
      return true
    }

    // 如果是 MIME 类型或 file_type，检查是否在支持范围内
    const info = getFileInfo(input)
    return info.type === 'image' || info.type === 'video'
  } catch (error) {
    return false
  }
}

// 获取文件类型的显示名称
export function getFileTypeDisplayName(input: string): string {
  const info = getFileInfo(input)
  return info.displayName
}

// 获取具体格式的显示名称（如 JPEG, MP4 等）
export function getFileFormatDisplayName(input: string): string {
  // 如果是 MIME 类型，返回格式名称
  if (input.includes('/')) {
    const format = input.split('/')[1]?.toUpperCase()
    return format || 'Unknown'
  }

  // 如果是后端 file_type，返回类型名称
  const info = getFileInfo(input)
  return info.displayName
}