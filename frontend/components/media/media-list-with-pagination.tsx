'use client'

import { useState, useEffect } from 'react'
import { useMediaList } from '@/hooks/use-media'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Search,
  Eye,
  Edit,
  Trash2,
  Download,
  Calendar,
  HardDrive,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  Tag as TagIcon,
  FolderOpen,
  Grid3x3,
  List
} from 'lucide-react'
import { MediaListItem, apiClient } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { MediaPreviewDialog } from './preview-dialog'

interface MediaListWithPaginationProps {
  onView?: (media: MediaListItem) => void
  onEdit?: (media: MediaListItem) => void
}

// 文件类型图标映射
const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case 'image':
      return FileImage
    case 'video':
      return FileVideo
    case 'audio':
      return FileAudio
    case 'document':
      return FileText
    default:
      return FileText
  }
}

// 文件大小格式化
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function MediaListWithPagination({ onView, onEdit }: MediaListWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchQuery, setSearchQuery] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [previewMedia, setPreviewMedia] = useState<MediaListItem | null>(null)
  const [categories, setCategories] = useState<Array<{id: number, name: string}>>([])
  const [tags, setTags] = useState<Array<{id: number, name: string}>>([])

  // 获取分类和标签数据
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await apiClient.getCategories(1, 1000) // 获取所有分类
        if (response.code === 200) {
          setCategories(response.data.results || [])
        }
      } catch (error) {
        console.error('获取分类失败:', error)
      }
    }

    const fetchTags = async () => {
      try {
        const response = await apiClient.getTags(1, 1000) // 获取所有标签
        if (response.code === 200) {
          setTags(response.data.results || [])
        }
      } catch (error) {
        console.error('获取标签失败:', error)
      }
    }

    fetchCategories()
    fetchTags()
  }, [])

  const { mediaList, isLoading, error, refetch } = useMediaList(
    currentPage,
    pageSize,
    searchQuery,
    selectedCategory ? parseInt(selectedCategory) : undefined,
    selectedTag ? parseInt(selectedTag) : undefined,
    fileTypeFilter || undefined
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1) // 搜索时重置到第一页
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize)
    setCurrentPage(1) // 改变页面大小时重置到第一页
  }

  const handleFileTypeChange = (value: string) => {
    setFileTypeFilter(value)
    setCurrentPage(1) // 改变过滤器时重置到第一页
  }

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value)
    setCurrentPage(1) // 改变过滤器时重置到第一页
  }

  const handleTagChange = (value: string) => {
    setSelectedTag(value)
    setCurrentPage(1) // 改变过滤器时重置到第一页
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && mediaList?.results) {
      setSelectedItems(mediaList.results.map(item => item.id))
    } else {
      setSelectedItems([])
    }
  }

  const handleSelectItem = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, id])
    } else {
      setSelectedItems(prev => prev.filter(item => item !== id))
    }
  }

  const handlePreview = (media: MediaListItem) => {
    setPreviewMedia(media)
    if (onView) {
      onView(media)
    }
  }

  const handleEdit = (media: MediaListItem) => {
    if (onEdit) {
      onEdit(media)
    }
  }

  const handleDownload = async (media: MediaListItem) => {
    try {
      const link = document.createElement('a')
      link.href = media.file_url
      link.download = media.title
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      toast.error('下载失败')
    }
  }

  const handleDelete = async (media: MediaListItem) => {
    if (!confirm(`确定要删除文件"${media.title}"吗？此操作不可恢复。`)) {
      return
    }

    try {
      const response = await apiClient.deleteMedia(media.id)
      if (response.code === 200) {
        toast.success('文件删除成功')
        refetch() // 重新获取列表
      } else {
        toast.error(response.message || '删除失败')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) {
      toast.error('请选择要删除的文件')
      return
    }

    if (!confirm(`确定要删除选中的 ${selectedItems.length} 个文件吗？此操作不可恢复。`)) {
      return
    }

    try {
      const response = await apiClient.batchDeleteMedia({ ids: selectedItems })
      if (response.code === 200) {
        toast.success(`成功删除 ${response.data.deleted_count} 个文件`)
        setSelectedItems([])
        refetch() // 重新获取列表
      } else {
        toast.error(response.message || '批量删除失败')
      }
    } catch (error) {
      toast.error('批量删除失败')
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const FileIcon = ({ fileType }: { fileType: string }) => {
    const Icon = getFileIcon(fileType)
    return <Icon className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <Card>
      <CardContent>
        {/* 搜索和过滤栏 */}
        <div className="mb-6 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                placeholder="搜索文件标题、描述或提示词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button type="submit" variant="outline">
              搜索
            </Button>
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchQuery('')
                  setCurrentPage(1)
                }}
              >
                清除
              </Button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">文件类型:</span>
              <Select value={fileTypeFilter || "all"} onValueChange={(value) => handleFileTypeChange(value === "all" ? "" : value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="image">图片</SelectItem>
                  <SelectItem value="video">视频</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">分类:</span>
              <Select value={selectedCategory || "all"} onValueChange={(value) => handleCategoryChange(value === "all" ? "" : value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">标签:</span>
              <Select value={selectedTag || "all"} onValueChange={(value) => handleTagChange(value === "all" ? "" : value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部标签" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部标签</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id.toString()}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">视图:</span>
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="rounded-r-none"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-l-none"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 批量操作栏 */}
        {selectedItems.length > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-md flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              已选择 {selectedItems.length} 个文件
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedItems([])}>
                取消选择
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                批量删除
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(pageSize)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border rounded">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-10 w-10 rounded" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'table' ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedItems.length === mediaList?.results?.length && mediaList?.results?.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>预览</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>标签</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mediaList?.results?.map((media) => (
                  <TableRow key={media.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.includes(media.id)}
                        onCheckedChange={(checked) => handleSelectItem(media.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      {media.thumbnail_url ? (
                        <img
                          src={media.thumbnail_url}
                          alt={media.title}
                          className="h-10 w-10 object-cover rounded cursor-pointer hover:opacity-80"
                          onClick={() => handlePreview(media)}
                        />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded flex items-center justify-center cursor-pointer hover:bg-muted/80"
                             onClick={() => handlePreview(media)}>
                          <FileIcon fileType={media.file_type} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium max-w-48 truncate" title={media.title}>
                      {media.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {media.file_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(media.file_size)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {media.categories?.slice(0, 2).map((category) => (
                          <Badge key={category.id} variant="secondary" className="text-xs">
                            <FolderOpen className="h-3 w-3 mr-1" />
                            {category.name}
                          </Badge>
                        ))}
                        {media.categories && media.categories.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{media.categories.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {media.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-xs">
                            <TagIcon className="h-3 w-3 mr-1" />
                            {tag.name}
                          </Badge>
                        ))}
                        {media.tags && media.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{media.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
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
                          onClick={() => handlePreview(media)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(media)}
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
                          onClick={() => handleDelete(media)}
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
        ) : (
          /* 网格视图 */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {mediaList?.results?.map((media) => (
              <div
                key={media.id}
                className="relative border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-muted relative">
                  <Checkbox
                    className="absolute top-2 left-2 z-10 bg-white/80"
                    checked={selectedItems.includes(media.id)}
                    onCheckedChange={(checked) => handleSelectItem(media.id, checked as boolean)}
                  />
                  {media.thumbnail_url ? (
                    <img
                      src={media.thumbnail_url}
                      alt={media.title}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90"
                      onClick={() => handlePreview(media)}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-muted/80"
                      onClick={() => handlePreview(media)}
                    >
                      <FileIcon fileType={media.file_type} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate mb-1" title={media.title}>
                    {media.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <Badge variant="outline" className="capitalize text-xs">
                      {media.file_type}
                    </Badge>
                    <span>{formatFileSize(media.file_size)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {media.categories?.slice(0, 1).map((category) => (
                        <Badge key={category.id} variant="secondary" className="text-xs">
                          {category.name}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handlePreview(media)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleEdit(media)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(media)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && (!mediaList?.results || mediaList.results.length === 0) && (
          <div className="text-center py-12">
            <HardDrive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery || fileTypeFilter ? '未找到匹配的文件' : '暂无媒体文件'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || fileTypeFilter
                ? '尝试调整搜索条件或过滤器'
                : '上传您的第一个媒体文件开始使用'
              }
            </p>
          </div>
        )}

        {/* 分页 */}
        {!isLoading && mediaList && mediaList.count > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, mediaList.count)} 条，
              共 {mediaList.count} 条记录
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">每页显示:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={mediaList.total_pages}
                onPageChange={handlePageChange}
                maxVisiblePages={5} // 限制最多显示5个页码，避免溢出
                compact={false} // 使用完整模式，因为容器空间充足
              />
            </div>
          </div>
        )}

        {/* 预览对话框 */}
        <MediaPreviewDialog
          open={!!previewMedia}
          onOpenChange={(open) => !open && setPreviewMedia(null)}
          media={previewMedia}
          mediaList={mediaList?.results || []}
          onMediaChange={setPreviewMedia}
        />
      </CardContent>
    </Card>
  )
}