'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { projectApi } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  FolderKanban,
  Edit,
  Trash2,
  Search,
  Image as ImageIcon,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import type { Project } from '@/lib/types';
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

// 项目颜色配置
const PROJECT_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
];

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  // 获取项目颜色
  const getProjectColor = (id: number) => {
    return PROJECT_COLORS[id % PROJECT_COLORS.length];
  };

  // 过滤后的项目
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  }, [projects, searchQuery]);

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const response = await projectApi.getProjects();
      if (response.code === 200 && response.data) {
        const projectsData = Array.isArray(response.data) ? response.data : [];
        setProjects(projectsData);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('加载项目失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 打开新建对话框
  const handleCreate = () => {
    setEditingProject(null);
    setFormData({ name: '', description: '' });
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
    });
    setDialogOpen(true);
  };

  // 保存项目
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入项目名称');
      return;
    }

    setSaving(true);
    try {
      if (editingProject) {
        const response = await projectApi.updateProject(editingProject.id, formData);
        if (response.code === 200 && response.data) {
          setProjects(prev =>
            prev.map(p => p.id === editingProject.id ? response.data! : p)
          );
          toast.success('更新成功');
          setDialogOpen(false);
        } else {
          toast.error(response.message || '更新失败');
        }
      } else {
        const response = await projectApi.createProject(formData);
        if ((response.code === 201 || response.code === 200) && response.data) {
          setProjects(prev => [...prev, response.data!]);
          toast.success('创建成功');
          setDialogOpen(false);
        } else {
          toast.error(response.message || '创建失败');
        }
      }
    } catch (error: any) {
      toast.error(error?.message || (editingProject ? '更新失败' : '创建失败'));
    } finally {
      setSaving(false);
    }
  };

  // 删除项目
  const handleDelete = async () => {
    if (!projectToDelete) return;

    setDeleting(true);
    try {
      await projectApi.deleteProject(projectToDelete.id);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      toast.success('删除成功');
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  // 确认删除
  const confirmDelete = (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  // 切换单个选择
  const toggleSelect = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProjects.map(p => p.id)));
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    setDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => projectApi.deleteProject(id)));
      setProjects(prev => prev.filter(p => !selectedIds.has(p.id)));
      toast.success(`成功删除 ${selectedIds.size} 个项目`);
      setSelectedIds(new Set());
      setBatchDeleteDialogOpen(false);
    } catch (error) {
      toast.error('批量删除失败');
    } finally {
      setDeleting(false);
    }
  };

  // 清除选择
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  // 进入项目
  const handleOpenProject = (project: Project) => {
    router.push(`/dashboard/projects/${project.id}`);
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
        {selectedIds.size > 0 ? (
          // 多选模式
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={clearSelection}>
              取消选择
            </Button>
            <span className="text-sm text-muted-foreground">
              已选择 {selectedIds.size} 个项目
            </span>
          </div>
        ) : (
          // 正常模式
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBatchDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除选中 ({selectedIds.size})
            </Button>
          ) : (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Button>
          )}
        </div>
      </div>

      {/* 项目列表 */}
      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FolderKanban className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">暂无项目</h3>
            <p className="text-sm text-muted-foreground mb-4">创建项目来组织和管理您的媒体文件</p>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              创建第一个项目
            </Button>
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
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
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === filteredProjects.length && filteredProjects.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="全选"
                  />
                </TableHead>
                <TableHead>项目名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="w-24 text-center">文件数</TableHead>
                <TableHead className="w-32">创建时间</TableHead>
                <TableHead className="w-24 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className={`group ${selectedIds.has(project.id) ? 'bg-muted/50' : ''}`}
                >
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(project.id)}
                      onCheckedChange={() => toggleSelect(project.id)}
                      aria-label={`选择 ${project.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => handleOpenProject(project)}
                    >
                      <div className={`p-1.5 rounded-md ${getProjectColor(project.id)}`}>
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{project.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {project.description || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-normal">
                      {project.media_count || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(project.created_at)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => handleEdit(project, e)}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">编辑</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => confirmDelete(project, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">删除</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 编辑/新建对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProject ? '编辑项目' : '新建项目'}</DialogTitle>
            <DialogDescription>
              {editingProject ? '修改项目信息' : '创建一个新的项目集合'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">项目名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：产品展示、活动记录"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述（可选）</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="添加项目描述..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProject ? '保存' : '创建'}
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
              确定要删除项目 "{projectToDelete?.name}" 吗？
              <br />
              <span className="text-muted-foreground">此操作不可撤销。</span>
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

      {/* 批量删除确认对话框 */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size} 个项目吗？
              <br />
              <span className="text-muted-foreground">此操作不可撤销，项目中的文件不会被删除。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
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
