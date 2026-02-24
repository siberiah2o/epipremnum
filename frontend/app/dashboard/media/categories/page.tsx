'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { categoryApi, mediaApi } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  FolderOpen,
  Edit,
  Trash2,
  Search,
  Folder,
  FileImage,
  Settings2,
  ChevronRight,
} from 'lucide-react';
import type { Category } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MediaCount {
  [categoryId: number]: number;
}

// 分类颜色配置
const CATEGORY_COLORS = [
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mediaCounts, setMediaCounts] = useState<MediaCount>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // 获取分类颜色
  const getCategoryColor = (id: number) => {
    return CATEGORY_COLORS[id % CATEGORY_COLORS.length];
  };

  // 排序后的分类（按媒体数量降序）
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => (mediaCounts[b.id] || 0) - (mediaCounts[a.id] || 0));
  }, [categories, mediaCounts]);

  // 过滤后的分类
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return sortedCategories;
    const query = searchQuery.toLowerCase();
    return sortedCategories.filter(cat =>
      cat.name.toLowerCase().includes(query) ||
      (cat.description && cat.description.toLowerCase().includes(query))
    );
  }, [sortedCategories, searchQuery]);

  // 统计信息
  const stats = useMemo(() => ({
    total: categories.length,
    totalMedia: Object.values(mediaCounts).reduce((sum, count) => sum + count, 0),
    used: Object.values(mediaCounts).filter(count => count > 0).length,
  }), [categories, mediaCounts]);

  // 加载分类和媒体数量
  useEffect(() => {
    const loadData = async () => {
      try {
        const categoryResponse = await categoryApi.getCategories();
        if (categoryResponse.code === 200 && categoryResponse.data) {
          const categoriesData = Array.isArray(categoryResponse.data)
            ? categoryResponse.data
            : (categoryResponse.data.results || []);
          setCategories(categoriesData);

          const mediaResponse = await mediaApi.getImages();
          if (mediaResponse.code === 200 && mediaResponse.data) {
            const mediaList = Array.isArray(mediaResponse.data)
              ? mediaResponse.data
              : (mediaResponse.data.results || []);

            const counts: MediaCount = {};
            mediaList.forEach((media: any) => {
              if (media.category) {
                counts[media.category] = (counts[media.category] || 0) + 1;
              }
            });
            setMediaCounts(counts);
          }
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
        toast.error('加载分类失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 打开新建对话框
  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setDialogOpen(true);
  };

  // 保存分类
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入分类名称');
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        const response = await categoryApi.updateCategory(editingCategory.id, formData);
        if (response.code === 200 && response.data) {
          setCategories(prev =>
            prev.map(cat => cat.id === editingCategory.id ? response.data! : cat)
          );
          toast.success('更新成功');
        }
      } else {
        const response = await categoryApi.createCategory(formData);
        if ((response.code === 201 || response.code === 200) && response.data) {
          setCategories(prev => [...prev, response.data!]);
          toast.success('创建成功');
        }
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(editingCategory ? '更新失败' : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除分类
  const handleDelete = async () => {
    if (!categoryToDelete) return;

    setDeleting(true);
    try {
      await categoryApi.deleteCategory(categoryToDelete.id);
      setCategories(prev => prev.filter(cat => cat.id !== categoryToDelete.id));
      toast.success('删除成功');
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    } catch (error) {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  // 确认删除
  const confirmDelete = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索分类..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新建分类
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总分类数</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已使用</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.used}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已分类文件</CardTitle>
            <FileImage className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMedia}</div>
          </CardContent>
        </Card>
      </div>

      {/* 分类列表 */}
      {categories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">暂无分类</h3>
            <p className="text-sm text-muted-foreground mb-4">创建分类来组织您的媒体文件</p>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              创建第一个分类
            </Button>
          </CardContent>
        </Card>
      ) : filteredCategories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">未找到匹配项</h3>
            <p className="text-sm text-muted-foreground">尝试其他搜索关键词</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>分类名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="w-24 text-center">文件数</TableHead>
                <TableHead className="w-24 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.map((category) => {
                const mediaCount = mediaCounts[category.id] || 0;

                return (
                  <TableRow key={category.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-md ${getCategoryColor(category.id)}`}>
                          <Folder className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {category.description || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-normal">
                        {mediaCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">编辑</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => confirmDelete(category)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">删除</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 编辑/新建对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? '编辑分类' : '新建分类'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? '修改分类信息' : '创建一个新的媒体分类'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">分类名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：风景、人物、产品"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述（可选）</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="添加分类描述..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCategory ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除分类 "{categoryToDelete?.name}" 吗？
              <br />
              <span className="text-muted-foreground">
                该分类下的 {categoryToDelete ? mediaCounts[categoryToDelete.id] || 0 : 0} 个文件将不再属于此分类。
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
