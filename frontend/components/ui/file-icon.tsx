'use client'

import { getFileInfo } from '@/lib/file-utils'
import {
  FileImage,
  FileVideo,
  File as FileIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileIconProps {
  mimeType: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8'
}

export function FileIconComponent({ mimeType, size = 'md', className }: FileIconProps) {
  const fileInfo = getFileInfo(mimeType)
  const iconClass = cn(sizeClasses[size], className)

  const iconProps = {
    className: iconClass
  }

  switch (fileInfo.type) {
    case 'image':
      return <FileImage {...iconProps} />
    case 'video':
      return <FileVideo {...iconProps} />
    default:
      return <FileIcon {...iconProps} />
  }
}

// 更简洁的导出名称
export { FileIconComponent as FileIcon }