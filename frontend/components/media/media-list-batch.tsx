'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMediaList } from '@/hooks/use-media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Search,
  Eye,
  Edit,
  Trash2,
  Download,
  Calendar,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  Square,
  CheckSquare,
  FolderOpen,
  Tag,
  X,
  Settings
} from 'lucide-react'
import { MediaListItem, apiClient, MediaCategory, MediaTag } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { FileIcon } from '@/components/ui/file-icon'
import { getFileInfo } from '@/lib/file-utils'
import { useCategoriesAndTags } from '@/hooks/use-categories-tags'

interface MediaListBatchProps {
  onEdit?: (media: MediaListItem) => void
  onView?: (media: MediaListItem) => void
}

export function MediaListBatch({ onEdit, onView }: MediaListBatchProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const [fallbackToOriginal, setFallbackToOriginal] = useState<Set<number>>(new Set())

  // 多选相关状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isDragSelecting, setIsDragSelecting] = useState(false)
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null)

  // 批量操作对话框状态
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)
  const [batchCategoryDialogOpen, setBatchCategoryDialogOpen] = useState(false)
  const [batchTagDialogOpen, setBatchTagDialogOpen] = useState(false)
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)

  // 分类和标签数据
  const { categories, tags, isLoading: categoriesLoading } = useCategoriesAndTags()
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])
  const [selectedTags, setSelectedTags] = useState<number[]>([])

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mediaToDelete, setMediaToDelete] = useState<MediaListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const pageSize = 12
  const tableRef = useRef<HTMLDivElement>(null)

  const { mediaList, isLoading, error, refetch } = useMediaList(
    currentPage,
    pageSize,
    debouncedSearchQuery
  )

  // 防抖处理搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setCurrentPage(1) // 搜索时重置到第一页
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setSelectedIds(new Set()) // 换页时清空选择
  }

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  // 多选相关函数
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedIds(new Set())
  }

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (mediaList?.results) {
      const allIds = mediaList.results.map(item => item.id)
      if (selectedIds.size === allIds.length) {
        setSelectedIds(new Set())
      } else {
        setSelectedIds(new Set(allIds))
      }
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // 拖动选择相关函数
  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    if (e.button === 0 && isSelectionMode) { // 左键且在选择模式
      e.preventDefault()
      setIsDragSelecting(true)
      setDragStartIndex(index)
      setDragEndIndex(index)
    }
  }

  const handleMouseEnter = (index: number) => {
    if (isDragSelecting && dragStartIndex !== null) {
      setDragEndIndex(index)
    }
  }

  const handleMouseUp = () => {
    if (isDragSelecting && dragStartIndex !== null && dragEndIndex !== null && mediaList?.results) {
      const startIndex = Math.min(dragStartIndex, dragEndIndex)
      const endIndex = Math.max(dragStartIndex, dragEndIndex)

      const selectedItems = mediaList.results.slice(startIndex, endIndex + 1)
      const newSelectedIds = new Set(selectedIds)

      selectedItems.forEach(item => {
        newSelectedIds.add(item.id)
      })

      setSelectedIds(newSelectedIds)
    }

    setIsDragSelecting(false)
    setDragStartIndex(null)
    setDragEndIndex(null)
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp()
    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDragSelecting, dragStartIndex, dragEndIndex, selectedIds, mediaList?.results])

  const isRowSelected = (index: number) => {
    if (!mediaList?.results) return false
    const item = mediaList.results[index]
    return selectedIds.has(item.id)
  }

  const isRowInDragSelection = (index: number) => {
    if (!isDragSelecting || dragStartIndex === null || dragEndIndex === null) return false
    const start = Math.min(dragStartIndex, dragEndIndex)
    const end = Math.max(dragStartIndex, dragEndIndex)
    return index >= start && index <= end
  }

  // 批量操作函数
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return

    setIsProcessingBatch(true)
    try {
      await apiClient.batchDeleteMedia({ ids: Array.from(selectedIds) })
      toast.success(`成功删除 ${selectedIds.size} 个文件`)
      clearSelection()
      refetch()
    } catch (error) {
      console.error('批量删除失败:', error)
      toast.error(error instanceof Error ? error.message : '批量删除失败')
    } finally {
      setIsProcessingBatch(false)
      setBatchDeleteDialogOpen(false)
    }
  }

  const handleBatchUpdateCategories = async () => {
    if (selectedIds.size === 0 || selectedCategories.length === 0) return

    setIsProcessingBatch(true)
    try {
      await apiClient.batchUpdateCategories({
        ids: Array.from(selectedIds),
        category_ids: selectedCategories
      })
      toast.success(`成功为 ${selectedIds.size} 个文件更新分类`)
      clearSelection()
      setSelectedCategories([])
      refetch()
    } catch (error) {
      console.error('批量更新分类失败:', error)
      toast.error(error instanceof Error ? error.message : '批量更新分类失败')
    } finally {
      setIsProcessingBatch(false)
      setBatchCategoryDialogOpen(false)
    }
  }

  const handleBatchAddTags = async () => {
    if (selectedIds.size === 0 || selectedTags.length === 0) return

    setIsProcessingBatch(true)
    try {
      await apiClient.batchAddTags({
        ids: Array.from(selectedIds),
        tag_ids: selectedTags
      })
      toast.success(`成功为 ${selectedIds.size} 个文件添加标签`)
      clearSelection()
      setSelectedTags([])
      refetch()
    } catch (error) {
      console.error('批量添加标签失败:', error)
      toast.error(error instanceof Error ? error.message : '批量添加标签失败')
    } finally {
      setIsProcessingBatch(false)
      setBatchTagDialogOpen(false)
    }
  }

  const handleDownload = async (media: MediaListItem) => {
    try {
      const response = await fetch(media.file_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = media.title
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('文件下载开始')
    } catch (error) {
      toast.error('下载失败')
    }
  }

  const handleDeleteClick = (media: MediaListItem) => {
    setMediaToDelete(media)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!mediaToDelete) return

    setIsDeleting(true)
    try {
      await apiClient.deleteMedia(mediaToDelete.id)
      toast.success('媒体文件删除成功')
      setDeleteDialogOpen(false)
      setMediaToDelete(null)
      refetch()
    } catch (error) {
      console.error('删除失败:', error)
      toast.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setMediaToDelete(null)
  }

  const getFileIcon = (fileType: string) => {
    return <FileIcon mimeType={fileType} size="sm" />
  }

  const getFileTypeDisplayName = (fileType: string) => {
    return getFileInfo(fileType).displayName
  }

  const getFileFormatName = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    return extension?.toUpperCase() || 'Unknown'
  }

  const handleImageError = (media: MediaListItem) => {
    if (media.file_type === 'image' && media.thumbnail_url && !fallbackToOriginal.has(media.id)) {
      setFallbackToOriginal(prev => new Set([...prev, media.id]))
    } else {
      setImageErrors(prev => new Set([...prev, media.id]))
    }
  }

  const getImageSrc = (media: MediaListItem) => {
    if (imageErrors.has(media.id)) {
      return null
    }

    if (media.file_type === 'image' && fallbackToOriginal.has(media.id)) {
      return media.file_url
    }

    return media.thumbnail_url || media.file_url
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const totalPages = mediaList?.total_pages || 0
  const totalItems = mediaList?.count || 0

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>媒体文件</CardTitle>
            <CardDescription>
              共 {totalItems} 个文件，第 {currentPage} / {totalPages} 页
              {selectedIds.size > 0 && `，已选择 ${selectedIds.size} 个`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索媒体文件..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 w-64"
              />
            </div>

            {/* 选择模式切换按钮 */}
            <Button
              variant={isSelectionMode ? "default" : "outline"}
              size="sm"
              onClick={toggleSelectionMode}
              className="flex items-center gap-2"
            >
              {isSelectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {isSelectionMode ? "退出选择" : "多选"}
            </Button>

            {/* 批量操作工具栏 */}
            {isSelectionMode && selectedIds.size > 0 && (
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchCategoryDialogOpen(true)}
                  className="flex items-center gap-1"
                >
                  <FolderOpen className="h-4 w-4" />
                  分类
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchTagDialogOpen(true)}
                  className="flex items-center gap-1"
                >
                  <Tag className="h-4 w-4" />
                  标签
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchDeleteDialogOpen(true)}
                  className="flex items-center gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                {isSelectionMode && <Skeleton className="h-4 w-4" />}
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* 表格视图 */}
            <div className="rounded-md border" ref={tableRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSelectionMode && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={mediaList?.results ? selectedIds.size === mediaList.results.length : false}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead>文件</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mediaList?.results?.map((media, index) => (
                    <TableRow
                      key={media.id}
                      className={
                        (isRowSelected(index) || isRowInDragSelection(index))
                          ? "bg-muted/50"
                          : ""
                      }
                      onMouseDown={(e) => handleMouseDown(index, e)}
                      onMouseEnter={() => handleMouseEnter(index)}
                    >
                      {isSelectionMode && (
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(media.id)}
                            onCheckedChange={() => toggleSelection(media.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {(media.file_type === 'image' || media.file_type === 'video') && (media.thumbnail_url || media.file_url) ? (
                            imageErrors.has(media.id) ? (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                                   onClick={() => onView?.(media)}
                                   title="缩略图加载失败，点击查看详情">
                                <FileIcon mimeType={media.file_type === 'image' ? "image/jpeg" : "video/mp4"} size="sm" />
                              </div>
                            ) : (
                              <img
                                src={getImageSrc(media) || undefined}
                                alt={media.title}
                                className="h-10 w-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onError={() => handleImageError(media)}
                                onClick={() => onView?.(media)}
                                loading="lazy"
                                title={media.file_type === 'image' ? "点击查看图片" : "点击查看视频"}
                              />
                            )
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                                 onClick={() => onView?.(media)}
                                 title={media.file_type === 'video' ? "视频缩略图生成中..." : "点击查看详情"}>
                              <FileIcon mimeType={media.file_type === 'video' ? 'video/mp4' : 'application/octet-stream'} size="sm" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium cursor-pointer hover:text-primary transition-colors"
                               onClick={() => onView?.(media)}>
                              {media.title}
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {media.file_url}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {getFileIcon(media.file_type)}
                          {getFileTypeDisplayName(media.file_type)} ({getFileFormatName(media.file_url)})
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" />
                          {formatFileSize(media.file_size)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(media.created_at), {
                            addSuffix: true,
                            locale: zhCN
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView?.(media)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit?.(media)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(media)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(media)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalItems)} 条，共 {totalItems} 条
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>

                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 2 && page <= currentPage + 2)
                      ) {
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        )
                      }
                      if (
                        page === currentPage - 3 ||
                        page === currentPage + 3
                      ) {
                        return (
                          <span key={page} className="px-2 text-muted-foreground">
                            ...
                          </span>
                        )
                      }
                      return null
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* 空状态 */}
            {mediaList?.results?.length === 0 && (
              <div className="text-center py-12">
                <FileIcon mimeType="image/jpeg" size="lg" className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">暂无媒体文件</h3>
                <p className="text-muted-foreground">
                  上传您的第一个媒体文件开始管理
                </p>
              </div>
            )}

            {/* 批量删除确认对话框 */}
            <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>批量删除确认</DialogTitle>
                  <DialogDescription>
                    您确定要删除选中的 {selectedIds.size} 个媒体文件吗？此操作无法撤销。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setBatchDeleteDialogOpen(false)}
                    disabled={isProcessingBatch}
                  >
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleBatchDelete}
                    disabled={isProcessingBatch}
                  >
                    {isProcessingBatch ? '删除中...' : '确认删除'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 批量更新分类对话框 */}
            <Dialog open={batchCategoryDialogOpen} onOpenChange={setBatchCategoryDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>批量设置分类</DialogTitle>
                  <DialogDescription>
                    为选中的 {selectedIds.size} 个媒体文件设置分类
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Select value={selectedCategories.join(',')} onValueChange={(value) => setSelectedCategories(value.split(',').map(Number))}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setBatchCategoryDialogOpen(false)}
                    disabled={isProcessingBatch}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleBatchUpdateCategories}
                    disabled={isProcessingBatch || selectedCategories.length === 0}
                  >
                    {isProcessingBatch ? '处理中...' : '确认设置'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 批量添加标签对话框 */}
            <Dialog open={batchTagDialogOpen} onOpenChange={setBatchTagDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>批量添加标签</DialogTitle>
                  <DialogDescription>
                    为选中的 {selectedIds.size} 个媒体文件添加标签
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Select value={selectedTags.join(',')} onValueChange={(value) => setSelectedTags(value.split(',').map(Number))}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择标签" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id.toString()}>
                          {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setBatchTagDialogOpen(false)}
                    disabled={isProcessingBatch}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleBatchAddTags}
                    disabled={isProcessingBatch || selectedTags.length === 0}
                  >
                    {isProcessingBatch ? '处理中...' : '确认添加'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* 单个删除确认对话框 */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>确认删除</DialogTitle>
                  <DialogDescription>
                    您确定要删除媒体文件 "{mediaToDelete?.title}" 吗？此操作无法撤销。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={handleDeleteCancel}
                    disabled={isDeleting}
                  >
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteConfirm}
                    disabled={isDeleting}
                  >
                    {isDeleting ? '删除中...' : '确认删除'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  )
}