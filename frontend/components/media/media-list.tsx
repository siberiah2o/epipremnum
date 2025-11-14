'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMediaList } from '@/hooks/use-media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
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
  ChevronRight
} from 'lucide-react'
import { MediaListItem, apiClient } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { FileIcon } from '@/components/ui/file-icon'
import { getFileInfo } from '@/lib/file-utils'

interface MediaListProps {
  onEdit?: (media: MediaListItem) => void
  onView?: (media: MediaListItem) => void
}

export function MediaList({ onEdit, onView }: MediaListProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const [fallbackToOriginal, setFallbackToOriginal] = useState<Set<number>>(new Set())

  // 多选相关状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mediaToDelete, setMediaToDelete] = useState<MediaListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const pageSize = 12

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
  }

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  // 多选功能
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
      // Refresh the media list
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
    // 从文件名获取格式名称
    const extension = fileName.split('.').pop()?.toLowerCase()
    return extension?.toUpperCase() || 'Unknown'
  }

  const getDisplayFileName = (fileUrl: string) => {
    // 从URL中提取文件名用于显示
    if (!fileUrl) return 'Unknown'

    try {
      // 如果是完整URL，提取路径部分
      const url = new URL(fileUrl)
      const pathname = url.pathname

      // 获取最后一部分作为文件名
      const fileName = pathname.split('/').pop() || pathname

      // 如果是UUID格式，尝试显示更有意义的信息
      if (fileName.length === 32 || fileName.length === 36) {
        // 这是一个UUID，我们可以只显示类型和ID的一部分
        const parts = fileName.split('.')
        const fileExtension = parts[1] ? parts[1].toUpperCase() : 'FILE'
        return `媒体文件 (${fileExtension})`
      }

      return fileName
    } catch {
      // 如果不是有效的URL，直接返回
      const fileName = fileUrl.split('/').pop() || fileUrl

      // 检查是否是UUID格式
      if (fileName.length === 32 || fileName.length === 36) {
        const parts = fileName.split('.')
        const fileExtension = parts[1] ? parts[1].toUpperCase() : 'FILE'
        return `媒体文件 (${fileExtension})`
      }

      return fileName
    }
  }

  const handleImageError = (media: MediaListItem) => {
    // 如果当前使用的是缩略图且是图片文件，尝试回退到原图
    if (media.file_type === 'image' && media.thumbnail_url && !fallbackToOriginal.has(media.id)) {
      setFallbackToOriginal(prev => new Set([...prev, media.id]))
    } else {
      // 如果已经尝试过原图或者不是图片文件，则标记为错误
      setImageErrors(prev => new Set([...prev, media.id]))
    }
  }

  const getImageSrc = (media: MediaListItem) => {
    // 如果图片加载失败过
    if (imageErrors.has(media.id)) {
      return null
    }

    // 如果是图片且已经回退到原图
    if (media.file_type === 'image' && fallbackToOriginal.has(media.id)) {
      return media.file_url
    }

    // 优先使用缩略图，如果不存在则使用原图
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
    <>
      <Card>
        <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>媒体文件</CardTitle>
            <CardDescription>
              共 {totalItems} 个文件，第 {currentPage} / {totalPages} 页
              {selectedIds.size > 0 && (
                <span className="text-blue-600 font-medium">
                  ，已选择 {selectedIds.size} 个
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                className="text-xs"
              >
                取消选择
              </Button>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索媒体文件..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={mediaList?.results ? selectedIds.size === mediaList.results.length : false}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>文件</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mediaList?.results?.map((media) => (
                    <TableRow key={media.id} className={selectedIds.has(media.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(media.id)}
                          onCheckedChange={() => toggleSelection(media.id)}
                        />
                      </TableCell>
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
                            <p className="text-sm text-muted-foreground truncate max-w-xs" title={media.file_url}>
                              {getDisplayFileName(media.file_url)}
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
                      // 只显示当前页附近的页码
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
                      // 显示省略号
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

            {/* 删除确认对话框 */}
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
          </>
        )}
      </CardContent>
    </Card>

      {/* 浮动批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-background border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium">
                已选择 {selectedIds.size} 个文件
              </span>
            </div>
            <div className="h-4 w-px bg-border"></div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBatchDeleteDialogOpen(true)}
              disabled={isProcessingBatch}
              className="h-8"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={isProcessingBatch}
              className="h-8"
            >
              取消选择
            </Button>
          </div>
        </div>
      )}
    </>
  )
}