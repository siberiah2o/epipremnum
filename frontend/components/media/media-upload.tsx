'use client'

import { useState, useRef, useCallback } from 'react'
import { useMediaUpload, useCategories, useTags } from '@/hooks/use-media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Upload, X, File, Plus } from 'lucide-react'
import { FileIcon } from '@/components/ui/file-icon'
import { isUploadable, guessFileTypeFromFileName, getFileInfo } from '@/lib/file-utils'

export function MediaUpload() {
  const { uploadMedia, isLoading, error, progress } = useMediaUpload()
  const { categories } = useCategories()
  const { tags } = useTags()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prompt: ''
  })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map())
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []
    const newPreviewUrls = new Map(previewUrls)

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

      // 如果是第一个文件，用它来设置默认标题
      if (selectedFiles.length === 0 && validFiles.length > 0) {
        setFormData(prev => ({ ...prev, title: validFiles[0].name.split('.')[0] }))
      }

      toast.success(`成功添加 ${validFiles.length} 个文件`)
    }
  }, [selectedFiles, previewUrls])

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
      setSelectedFiles(prev => {
        const newFiles = prev.filter(f => !(f.name === fileToRemove.name && f.size === fileToRemove.size))

        // 如果移除的是当前用于设置标题的文件，更新标题
        if (prev[0]?.name === fileToRemove.name && prev[0]?.size === fileToRemove.size) {
          if (newFiles.length > 0) {
            setFormData(prev => ({ ...prev, title: newFiles[0].name.split('.')[0] }))
          } else {
            setFormData(prev => ({ ...prev, title: '' }))
          }
        }

        return newFiles
      })

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
      setFormData(prev => ({ ...prev, title: '' }))
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

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedFiles.length === 0) {
      toast.error('请选择要上传的文件')
      return
    }

    if (!formData.title.trim()) {
      toast.error('请输入媒体文件标题')
      return
    }

    let successCount = 0
    let failureCount = 0
    const totalFiles = selectedFiles.length

    // 批量上传每个文件
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]

      // 为每个文件生成唯一的标题
      const fileTitle = totalFiles === 1
        ? formData.title.trim()
        : `${formData.title.trim()} ${i + 1}`

      const uploadData = {
        file: file,
        title: fileTitle,
        description: formData.description.trim(),
        prompt: formData.prompt.trim(),
        category_ids: selectedCategories.length > 0 ? selectedCategories.map(id => parseInt(id)) : [],
        tag_ids: selectedTags.length > 0 ? selectedTags.map(id => parseInt(id)) : []
      }

      console.log(`Uploading file ${i + 1}/${totalFiles}:`, file.name)

      const result = await uploadMedia(uploadData)

      if (result.success) {
        successCount++
      } else {
        failureCount++
        console.error(`Failed to upload ${file.name}:`, result.message)
      }
    }

    // 显示结果
    if (successCount > 0 && failureCount === 0) {
      toast.success(`成功上传 ${successCount} 个文件`)
    } else if (successCount > 0 && failureCount > 0) {
      toast.warning(`成功上传 ${successCount} 个文件，失败 ${failureCount} 个文件`)
    } else {
      toast.error(`上传失败，请稍后重试`)
      return
    }

    // 重置表单
    setFormData({ title: '', description: '', prompt: '' })
    setSelectedFiles([])
    setPreviewUrls(new Map())
    setSelectedCategories([])
    setSelectedTags([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-7xl mx-auto">
      {/* 左侧：文件上传区域 */}
      <div className="space-y-4">
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
            <div className="space-y-4">
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
                    <span>上传进度</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}

              {/* 错误提示 */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 右侧：配置参数 */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>文件信息</CardTitle>
            <CardDescription>
              设置媒体文件的标题、描述和分类
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">标题 *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="输入媒体文件标题"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="输入媒体文件描述"
                    disabled={isLoading}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">生成提示词</Label>
                  <Textarea
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="输入用于生成的提示词或关键词"
                    disabled={isLoading}
                    rows={2}
                  />
                </div>
              </div>

              {/* 分类选择 */}
              <div className="space-y-2">
                <Label>分类</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(category => (
                    <Badge
                      key={category.id}
                      variant={selectedCategories.includes(category.id.toString()) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleCategoryToggle(category.id.toString())}
                    >
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 标签选择 */}
              <div className="space-y-2">
                <Label>标签</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge
                      key={tag.id}
                      variant={selectedTags.includes(tag.id.toString()) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleTagToggle(tag.id.toString())}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 提交按钮 */}
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
    </div>
  )
}