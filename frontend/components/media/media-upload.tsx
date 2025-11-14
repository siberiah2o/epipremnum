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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((file: File) => {
    try {
      // 检查文件类型是否支持上传（与后端验证逻辑一致）
      if (!isUploadable(file.name)) {
        toast.error('不支持的文件类型。只支持图片(jpg, png, gif, bmp, webp)和视频(mp4, avi, mov, wmv, flv, webm)')
        return
      }

      // 检查文件大小 (50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('文件大小不能超过 50MB')
        return
      }

      setSelectedFile(file)
      setFormData(prev => ({ ...prev, title: file.name.split('.')[0] }))

      // 创建预览（仅图片类型）
      const fileType = guessFileTypeFromFileName(file.name)
      if (fileType === 'image') {
        const reader = new FileReader()
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setPreviewUrl(null)
      }
    } catch (error) {
      toast.error('文件类型验证失败')
    }
  }, [])

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input change triggered', event.target.files)
    const file = event.target.files?.[0]
    if (file) {
      console.log('File selected:', file.name)
      handleFileSelect(file)
    } else {
      console.log('No file selected')
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
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleRemoveFile = () => {
    console.log('Removing file')
    setSelectedFile(null)
    setPreviewUrl(null)
    setFormData(prev => ({ ...prev, title: '' }))

    // 清理文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      // 强制重新渲染input元素
      const currentValue = fileInputRef.current.value
      fileInputRef.current.value = currentValue
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
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        handleFileSelect(file)
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

    if (!selectedFile) {
      toast.error('请选择要上传的文件')
      return
    }

    if (!formData.title.trim()) {
      toast.error('请输入媒体文件标题')
      return
    }

    // 调试信息
    console.log('Uploading file:', selectedFile)
    console.log('File type:', selectedFile?.constructor.name)
    console.log('Upload data:', {
      title: formData.title.trim(),
      description: formData.description.trim(),
      prompt: formData.prompt.trim(),
      category_ids: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
      tag_ids: selectedTags.length > 0 ? selectedTags.join(',') : undefined
    })

    const uploadData = {
      file: selectedFile,
      title: formData.title.trim(),
      description: formData.description.trim(),
      prompt: formData.prompt.trim(),
      category_ids: selectedCategories.length > 0 ? selectedCategories.map(id => parseInt(id)) : [],
      tag_ids: selectedTags.length > 0 ? selectedTags.map(id => parseInt(id)) : []
    }

    const result = await uploadMedia(uploadData)

    if (result.success) {
      toast.success('媒体文件上传成功')
      // 重置表单
      setFormData({ title: '', description: '', prompt: '' })
      setSelectedFile(null)
      setPreviewUrl(null)
      setSelectedCategories([])
      setSelectedTags([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } else {
      toast.error(result.message || '上传失败')
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
                    : selectedFile
                    ? 'border-green-500 bg-green-50'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => forceFileSelect()}
              >
                {selectedFile ? (
                  <div className="space-y-4">
                    {previewUrl ? (
                      <div className="relative rounded-lg overflow-hidden bg-muted mx-auto w-fit">
                        <img
                          src={previewUrl}
                          alt="预览"
                          className="w-full max-w-xs h-48 object-cover"
                        />
                        <div className="absolute top-2 right-2">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveFile()
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                          <FileIcon mimeType={guessFileTypeFromFileName(selectedFile.name)} size="sm" className="inline mr-1" />
                          {selectedFile.name.split('.').pop()?.toUpperCase() || 'Unknown'}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <FileIcon mimeType={guessFileTypeFromFileName(selectedFile.name)} size="lg" className="text-muted-foreground" />
                        <div className="text-center">
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {getFileInfo(guessFileTypeFromFileName(selectedFile.name)).displayName} • {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveFile()
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          移除文件
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium">拖拽文件到这里</p>
                      <p className="text-sm text-muted-foreground">或点击选择文件</p>
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
                onChange={handleFileInputChange}
                disabled={isLoading}
                className="hidden"
                key={selectedFile ? 'selected' : 'empty'} // 强制重新渲染以解决状态问题
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
                disabled={isLoading || !selectedFile}
                size="lg"
              >
                {isLoading ? '上传中...' : '上传媒体文件'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}