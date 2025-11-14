'use client'

import { useState } from 'react'
import { useCategories } from '@/hooks/use-media'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Plus,
  Edit,
  Trash2,
  FolderOpen,
  Calendar
} from 'lucide-react'
import { MediaCategory } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function CategoryManager() {
  const { categories, isLoading, error, createCategory, updateCategory, deleteCategory } = useCategories()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MediaCategory | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  const resetForm = () => {
    setFormData({ name: '', description: '' })
    setEditingCategory(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('请输入分类名称')
      return
    }

    setIsSubmitting(true)
    const result = await createCategory({
      name: formData.name.trim(),
      description: formData.description.trim()
    })

    if (result.success) {
      toast.success('分类创建成功')
      resetForm()
      setIsCreateDialogOpen(false)
    } else {
      toast.error(result.message || '创建失败')
    }
    setIsSubmitting(false)
  }

  const handleEdit = (category: MediaCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory || !formData.name.trim()) {
      toast.error('请输入分类名称')
      return
    }

    setIsSubmitting(true)
    const result = await updateCategory(editingCategory.id, {
      name: formData.name.trim(),
      description: formData.description.trim()
    })

    if (result.success) {
      toast.success('分类更新成功')
      resetForm()
      setIsEditDialogOpen(false)
    } else {
      toast.error(result.message || '更新失败')
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (category: MediaCategory) => {
    if (!confirm(`确定要删除分类"${category.name}"吗？此操作不可恢复。`)) {
      return
    }

    const result = await deleteCategory(category.id)
    if (result.success) {
      toast.success('分类删除成功')
    } else {
      toast.error(result.message || '删除失败')
    }
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
              <FolderOpen className="h-5 w-5" />
              分类管理
            </CardTitle>
            <CardDescription>
              管理媒体文件的分类
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新建分类
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新分类</DialogTitle>
                <DialogDescription>
                  创建一个新的媒体文件分类
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">分类名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入分类名称"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="输入分类描述"
                    disabled={isSubmitting}
                    rows={3}
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
                    {isSubmitting ? '创建中...' : '创建分类'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-48" />
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
                  <TableHead>描述</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {category.description || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(category.created_at), {
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
                          onClick={() => handleEdit(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(category)}
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
        {!isLoading && categories.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无分类</h3>
            <p className="text-muted-foreground mb-4">
              创建您的第一个分类来组织媒体文件
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              创建分类
            </Button>
          </div>
        )}

        {/* 编辑对话框 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑分类</DialogTitle>
              <DialogDescription>
                修改分类信息
              </DialogDescription>
            </DialogHeader>
            {editingCategory && (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">分类名称 *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入分类名称"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">描述</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="输入分类描述"
                    disabled={isSubmitting}
                    rows={3}
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
                    {isSubmitting ? '更新中...' : '更新分类'}
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