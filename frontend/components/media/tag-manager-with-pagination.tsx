'use client'

import { useState } from 'react'
import { useTags } from '@/hooks/use-media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  Tag as TagIcon,
  Calendar,
  Search
} from 'lucide-react'
import { MediaTag } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function TagManagerWithPagination() {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<MediaTag | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { tagList, tags, isLoading, error, createTag, updateTag, deleteTag } = useTags(
    currentPage,
    pageSize,
    searchQuery
  )

  const [formData, setFormData] = useState({
    name: ''
  })

  const resetForm = () => {
    setFormData({ name: '' })
    setEditingTag(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('请输入标签名称')
      return
    }

    setIsSubmitting(true)
    const result = await createTag({
      name: formData.name.trim()
    })

    if (result.success) {
      toast.success('标签创建成功')
      resetForm()
      setIsCreateDialogOpen(false)
      // 创建成功后回到第一页
      setCurrentPage(1)
    } else {
      toast.error(result.message || '创建失败')
    }
    setIsSubmitting(false)
  }

  const handleEdit = (tag: MediaTag) => {
    setEditingTag(tag)
    setFormData({
      name: tag.name
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTag || !formData.name.trim()) {
      toast.error('请输入标签名称')
      return
    }

    setIsSubmitting(true)
    const result = await updateTag(editingTag.id, {
      name: formData.name.trim()
    })

    if (result.success) {
      toast.success('标签更新成功')
      resetForm()
      setIsEditDialogOpen(false)
    } else {
      toast.error(result.message || '更新失败')
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (tag: MediaTag) => {
    if (!confirm(`确定要删除标签"${tag.name}"吗？此操作不可恢复。`)) {
      return
    }

    const result = await deleteTag(tag.id)
    if (result.success) {
      toast.success('标签删除成功')
      // 如果当前页没有数据了，回到上一页
      if (tags.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1)
      }
    } else {
      toast.error(result.message || '删除失败')
    }
  }

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
            <CardTitle className="flex items-center gap-2">
              <TagIcon className="h-5 w-5" />
              标签管理
            </CardTitle>
            <CardDescription>
              管理媒体文件的标签
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新建标签
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新标签</DialogTitle>
                <DialogDescription>
                  创建一个新的媒体文件标签
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">标签名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入标签名称"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? '创建中...' : '创建标签'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* 搜索栏 */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索标签名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
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
          </div>
        </form>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(pageSize)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TagIcon className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary">{tag.name}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(tag.created_at), {
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
                          onClick={() => handleEdit(tag)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(tag)}
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
        )}

        {/* 空状态 */}
        {!isLoading && tags.length === 0 && (
          <div className="text-center py-12">
            <TagIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? '未找到匹配的标签' : '暂无标签'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? '尝试调整搜索关键词或创建新标签'
                : '创建您的第一个标签来标记媒体文件'
              }
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                创建标签
              </Button>
            )}
          </div>
        )}

        {/* 分页 */}
        {!isLoading && tagList && tagList.count > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, tagList.count)} 条，
              共 {tagList.count} 条记录
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">每页显示:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={tagList.total_pages}
                onPageChange={handlePageChange}
                maxVisiblePages={7} // 标签列表通常页数较少，可以显示更多页码
                compact={false} // 使用完整模式
              />
            </div>
          </div>
        )}

        {/* 编辑对话框 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑标签</DialogTitle>
              <DialogDescription>
                修改标签名称
              </DialogDescription>
            </DialogHeader>
            {editingTag && (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">标签名称 *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入标签名称"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? '更新中...' : '更新标签'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}