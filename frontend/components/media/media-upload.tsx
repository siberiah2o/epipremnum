'use client'

import { useState, useRef, useCallback } from 'react'
import { useMediaUpload } from '@/hooks/use-media'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Upload, X, Plus } from 'lucide-react'
import { FileIcon } from '@/components/ui/file-icon'
import { isUploadable, guessFileTypeFromFileName, getFileInfo } from '@/lib/file-utils'

export function MediaUpload() {
  const { uploadMultipleMedia, isLoading, error, progress, currentFileIndex, totalFiles, resetProgress } = useMediaUpload()

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map())
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []

    fileArray.forEach(file => {
      try {
        // 检查文件类型是否支持上传（与后端验证逻辑一致）
        if (!isUploadable(file.name)) {
          toast.error(`文件 "${file.name}" 不支持。只支持图片和视频文件`)
          return
        }

        // 检查文件大小 (50MB)
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`文件 "${file.name}" 大小超过 50MB`)
          return
        }

        // 检查是否已经选择过相同文件
        if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
          toast.error(`文件 "${file.name}" 已经选择过了`)
          return
        }

        validFiles.push(file)

        // 创建预览（仅图片类型）
        const fileType = guessFileTypeFromFileName(file.name)
        if (fileType === 'image') {
          const reader = new FileReader()
          reader.onload = (e) => {
            setPreviewUrls(prev => new Map(prev.set(file.name + file.size, e.target?.result as string)))
          }
          reader.readAsDataURL(file)
        }
      } catch (error) {
        toast.error(`文件 "${file.name}" 验证失败`)
      }
    })

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles])
      toast.success(`成功添加 ${validFiles.length} 个文件`)
    }
  }, [selectedFiles])

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input change triggered', event.target.files)
    const files = event.target.files
    if (files && files.length > 0) {
      console.log('Files selected:', files.length)
      handleFileSelect(files)
    } else {
      console.log('No files selected')
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files)
    }
  }, [handleFileSelect])

  const handleRemoveFile = (fileToRemove?: File) => {
    if (fileToRemove) {
      // 移除特定文件
      setSelectedFiles(prev => prev.filter(f => !(f.name === fileToRemove.name && f.size === fileToRemove.size)))

      // 移除对应的预览图
      setPreviewUrls(prev => {
        const newUrls = new Map(prev)
        newUrls.delete(fileToRemove.name + fileToRemove.size)
        return newUrls
      })
    } else {
      // 清空所有文件
      setSelectedFiles([])
      setPreviewUrls(new Map())
    }

    // 清理文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 强制触发文件选择的备选方法
  const forceFileSelect = () => {
    console.log('Force file select called')

    // 方法1: 使用ref
    if (fileInputRef.current) {
      console.log('Using ref method')
      fileInputRef.current.click()
      return
    }

    // 方法2: 创建新的input元素
    console.log('Creating new input element')
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.jpg,.jpeg,.png,.gif,.bmp,.webp,.mp4,.avi,.mov,.wmv,.flv,.webm'
    input.multiple = true // 支持多选
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const files = target.files
      if (files && files.length > 0) {
        handleFileSelect(files)
      }
    }
    input.click()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedFiles.length === 0) {
      toast.error('请选择要上传的文件')
      return
    }

    // 使用新的批量上传方法
    const result = await uploadMultipleMedia(selectedFiles, (file) => {
      // 使用文件名作为标题，去掉扩展名
      const fileTitle = file.name.split('.').slice(0, -1).join('.')

      return {
        file: file,
        title: fileTitle,
        description: '',
        prompt: '',
        category_ids: [],
        tag_ids: []
      }
    })

    // 显示结果
    if (result.successCount > 0 && result.failureCount === 0) {
      toast.success(`成功上传 ${result.successCount} 个文件`)
    } else if (result.successCount > 0 && result.failureCount > 0) {
      toast.warning(`成功上传 ${result.successCount} 个文件，失败 ${result.failureCount} 个文件`)
    } else {
      toast.error(`上传失败，请稍后重试`)
      return
    }

    // 重置表单
    setSelectedFiles([])
    setPreviewUrls(new Map())
    resetProgress()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            上传文件
          </CardTitle>
          <CardDescription>
            支持图片和视频文件，最大 50MB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 拖拽上传区域 */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : selectedFiles.length > 0
                  ? 'border-green-500 bg-green-50'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => forceFileSelect()}
            >
              {selectedFiles.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-lg font-medium">已选择 {selectedFiles.length} 个文件</p>
                    <p className="text-sm text-muted-foreground">总大小: {(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB</p>
                  </div>

                  {/* 文件列表 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {selectedFiles.map((file, index) => {
                      const previewUrl = previewUrls.get(file.name + file.size)
                      const fileType = guessFileTypeFromFileName(file.name)

                      return (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="relative border rounded-lg p-3 bg-background hover:bg-muted/50 transition-colors"
                        >
                          {/* 文件预览/图标 */}
                          <div className="flex items-center gap-3">
                            {previewUrl ? (
                              <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
                                <img
                                  src={previewUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <FileIcon mimeType={fileType} size="sm" className="text-muted-foreground" />
                              </div>
                            )}

                            {/* 文件信息 */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {getFileInfo(fileType).displayName} • {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>

                            {/* 移除按钮 */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveFile(file)
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 添加更多文件按钮 */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      forceFileSelect()
                    }}
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    添加更多文件
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">拖拽文件到这里</p>
                    <p className="text-sm text-muted-foreground">支持多文件选择</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      forceFileSelect()
                    }}
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    选择文件
                  </Button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.mp4,.avi,.mov,.wmv,.flv,.webm"
              multiple={true}
              onChange={handleFileInputChange}
              disabled={isLoading}
              className="hidden"
              key={selectedFiles.length > 0 ? 'selected' : 'empty'} // 强制重新渲染以解决状态问题
            />

            {/* 上传进度 */}
            {isLoading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {totalFiles > 1
                      ? `上传进度: ${currentFileIndex}/${totalFiles} 个文件`
                      : '上传进度'
                    }
                  </span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
                {totalFiles > 1 && (
                  <p className="text-xs text-muted-foreground text-center">
                    正在上传第 {currentFileIndex} 个文件，共 {totalFiles} 个文件
                  </p>
                )}
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* 上传按钮 */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || selectedFiles.length === 0}
              size="lg"
            >
              {isLoading
                ? `上传中... (${selectedFiles.length} 个文件)`
                : `上传媒体文件${selectedFiles.length > 1 ? ` (${selectedFiles.length} 个文件)` : ''}`
              }
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}