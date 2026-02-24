'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { projectApi, mediaApi, categoryApi, llmAnalysisApi } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  ImageIcon,
  Search,
  X,
  Trash2,
  FolderOpen,
  Images,
  Filter,
  Download,
  Check,
  Clock,
  Save,
  FileText,
  Settings,
} from 'lucide-react';
import type { Project, ProjectMedia, Media, Category } from '@/lib/types';
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

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [projectMedia, setProjectMedia] = useState<ProjectMedia[]>([]);
  const [allMedia, setAllMedia] = useState<Media[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMediaId, setAddingMediaId] = useState<number | null>(null);

  // 素材库筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // 项目编辑状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  // 导出状态
  const [exporting, setExporting] = useState(false);

  // 批量编辑对话框状态
  const [editDescriptionsOpen, setEditDescriptionsOpen] = useState(false);
  const [editedDescriptions, setEditedDescriptions] = useState<Record<number, string>>({});
  const [savingDescriptions, setSavingDescriptions] = useState<Record<number, boolean>>({});

  // 触发词状态
  const [triggerWord, setTriggerWord] = useState('');

  // 获取项目中已添加的媒体ID集合
  const projectMediaIds = useMemo(() => new Set(projectMedia.map(m => m.media)), [projectMedia]);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [projectRes, mediaRes, categoriesRes] = await Promise.all([
        projectApi.getProject(projectId),
        projectApi.getProjectMedia(projectId),
        categoryApi.getCategories(),
      ]);

      // 处理项目数据
      if (projectRes) {
        if ('data' in projectRes && projectRes.data) {
          setProject(projectRes.data);
        } else if ('id' in projectRes) {
          setProject(projectRes as unknown as Project);
        }
      }

      // 处理项目媒体数据
      if (mediaRes) {
        const res = mediaRes as any;
        if (Array.isArray(res)) {
          setProjectMedia(res);
        } else if (res.results) {
          setProjectMedia(res.results);
        } else if (res.code === 200 && res.data) {
          const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
          setProjectMedia(data);
        }
      }

      // 处理分类数据
      if (categoriesRes) {
        const res = categoriesRes as any;
        if (Array.isArray(res)) {
          setCategories(res);
        } else if (res.results) {
          setCategories(res.results);
        } else if (res.code === 200 && res.data) {
          const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
          setCategories(data);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // 加载所有媒体
  const loadAllMedia = useCallback(async () => {
    try {
      const response = await mediaApi.getImages({ page: 1, page_size: 1000 });
      if (response.code === 200 && response.data) {
        const mediaData = Array.isArray(response.data)
          ? response.data
          : (response.data.results || []);
        setAllMedia(mediaData);
      }
    } catch (error) {
      console.error('Failed to load all media:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadAllMedia();
  }, [loadData, loadAllMedia]);

  // 打开编辑对话框
  const handleEditProject = () => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
      });
      setEditDialogOpen(true);
    }
  };

  // 保存项目
  const handleSaveProject = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入项目名称');
      return;
    }

    setSaving(true);
    try {
      const response = await projectApi.updateProject(projectId, formData);
      if (response.code === 200 && response.data) {
        setProject(response.data);
        toast.success('更新成功');
        setEditDialogOpen(false);
      }
    } catch (error) {
      toast.error('更新失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除项目
  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      await projectApi.deleteProject(projectId);
      toast.success('删除成功');
      router.push('/dashboard/projects');
    } catch (error) {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  // 添加媒体到项目
  const handleAddMedia = async (mediaId: number) => {
    setAddingMediaId(mediaId);
    try {
      await projectApi.addMedia(projectId, { media_ids: [mediaId] });
      toast.success('添加成功');
      await loadData();
    } catch (error) {
      toast.error('添加失败');
    } finally {
      setAddingMediaId(null);
    }
  };

  // 从项目中移除媒体
  const handleRemoveMedia = async (mediaId: number) => {
    try {
      await projectApi.removeMedia(projectId, { media_id: mediaId });
      toast.success('移除成功');
      await loadData();
    } catch (error) {
      toast.error('移除失败');
    }
  };

  // 打开批量编辑对话框
  const handleOpenEditDescriptions = () => {
    const initialDescriptions: Record<number, string> = {};
    projectMedia.forEach((item) => {
      if (item.media_details) {
        initialDescriptions[item.media] = item.media_details.analysis_description || '';
      }
    });
    setEditedDescriptions(initialDescriptions);
    setSavingDescriptions({});
    setEditDescriptionsOpen(true);
  };

  // 更新单个描述
  const handleUpdateDescription = (mediaId: number, description: string) => {
    setEditedDescriptions(prev => ({
      ...prev,
      [mediaId]: description,
    }));
  };

  // 保存单个描述
  const handleSaveDescription = async (item: ProjectMedia) => {
    const mediaId = item.media;
    const analysisId = item.media_details?.analysis_id;

    if (!analysisId) {
      toast.error('该图片没有分析记录');
      return;
    }

    const description = editedDescriptions[mediaId];
    if (description === undefined) return;

    setSavingDescriptions(prev => ({ ...prev, [mediaId]: true }));
    try {
      const response = await llmAnalysisApi.updateDescription(analysisId, description);

      if (response.code === 200) {
        toast.success('描述已保存');

        setProjectMedia(prev => prev.map(p => {
          if (p.media === mediaId && p.media_details) {
            return {
              ...p,
              media_details: {
                ...p.media_details,
                analysis_description: description,
              },
            };
          }
          return p;
        }));
      } else {
        toast.error(response.message || '保存失败');
      }
    } catch (error) {
      toast.error('保存失败');
    } finally {
      setSavingDescriptions(prev => ({ ...prev, [mediaId]: false }));
    }
  };

  // 导出 LoRA 训练数据集
  const handleExportLoraDataset = async () => {
    if (projectMedia.length === 0) {
      toast.error('项目中没有图片');
      return;
    }

    setExporting(true);
    try {
      await projectApi.exportLoraDataset(projectId, triggerWord.trim() || undefined);
      toast.success(`成功导出 ${projectMedia.length} 个训练数据`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败';
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  // 过滤素材库
  const filteredLibraryMedia = allMedia.filter((m: Media) => {
    const matchSearch = m.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = !selectedCategory || m.category_name === selectedCategory;
    const notInProject = !projectMediaIds.has(m.id);
    return matchSearch && matchCategory && notInProject;
  });

  // 获取文件URL
  const getFileUrl = (path: string | undefined) => {
    if (!path) return '';
    let filePath = path;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      try {
        const url = new URL(path);
        filePath = url.pathname;
      } catch {
        return path;
      }
    }
    if (filePath.startsWith('/upload/')) filePath = filePath.slice(8);
    else if (filePath.startsWith('upload/')) filePath = filePath.slice(7);
    return `/api/media/file/${filePath}`;
  };

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-5rem)]">
      {/* 顶部信息栏 */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          {project.description && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <span className="text-sm text-muted-foreground">{project.description}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenEditDescriptions}
            disabled={projectMedia.length === 0}
          >
            <FileText className="mr-2 h-4 w-4" />
            编辑描述
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <div className="flex items-center gap-2">
            <Input
              placeholder="触发词（可选）"
              value={triggerWord}
              onChange={(e) => setTriggerWord(e.target.value)}
              className="w-32 h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={handleExportLoraDataset}
              disabled={exporting || projectMedia.length === 0}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              导出
            </Button>
          </div>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEditProject}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* 左侧：素材库 */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="flex-shrink-0 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Images className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">素材库</CardTitle>
              </div>
              <Badge variant="secondary">{filteredLibraryMedia.length} 可添加</Badge>
            </div>
            {/* 搜索框 */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索素材名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* 分类筛选 */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Badge
                  variant={!selectedCategory ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory('')}
                >
                  全部
                </Badge>
                {categories.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant={selectedCategory === cat.name ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedCategory(cat.name)}
                  >
                    {cat.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto min-h-0 p-4 pt-0">
            {filteredLibraryMedia.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {allMedia.length === 0 ? '暂无素材，请先上传' : '所有素材已添加到项目'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {filteredLibraryMedia.map((media) => (
                  <div
                    key={media.id}
                    className="group relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-primary transition-all"
                    onClick={() => handleAddMedia(media.id)}
                  >
                    {getFileUrl(media.file_url) ? (
                      <img
                        src={getFileUrl(media.file_url)}
                        alt={media.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* Hover 遮罩 */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      <div className="p-2 rounded-full bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="h-5 w-5" />
                      </div>
                    </div>
                    {/* 加载状态 */}
                    {addingMediaId === media.id && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                    {/* 分类标签 */}
                    {media.category_name && (
                      <span className="absolute top-2 left-2 text-[10px] bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full font-medium">
                        {media.category_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右侧：项目素材 */}
        <Card className="w-80 flex flex-col min-h-0 flex-shrink-0">
          <CardHeader className="flex-shrink-0 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">项目素材</CardTitle>
              </div>
              <Badge variant="secondary">{projectMedia.length} 个文件</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto min-h-0 p-4 pt-0">
            {projectMedia.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FolderOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">点击左侧素材添加到项目</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {projectMedia.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square bg-muted rounded-lg overflow-hidden"
                  >
                    {getFileUrl(item.media_details?.file_url) ? (
                      <img
                        src={getFileUrl(item.media_details?.file_url)}
                        alt={item.media_details?.filename || item.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* 删除按钮 */}
                    <button
                      onClick={() => handleRemoveMedia(item.media)}
                      className="absolute top-1 left-1 w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-destructive text-muted-foreground hover:text-destructive-foreground flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 编辑项目对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
            <DialogDescription>修改项目信息</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">项目名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入项目名称"
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
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSaveProject} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
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
              确定要删除项目 "{project?.name}" 吗？
              <br />
              <span className="text-muted-foreground">项目中的文件不会被删除，只是取消关联。此操作不可撤销。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量编辑描述对话框 */}
      <Dialog open={editDescriptionsOpen} onOpenChange={setEditDescriptionsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>编辑训练描述</DialogTitle>
            <DialogDescription>
              修改每张图片的AI描述，编辑后点击保存按钮
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead className="w-24">缩略图</TableHead>
                  <TableHead className="min-w-[300px]">描述（提示词）</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                  <TableHead className="w-20">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectMedia.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="w-16 h-16 bg-muted rounded overflow-hidden">
                        {getFileUrl(item.media_details?.file_url) ? (
                          <img
                            src={getFileUrl(item.media_details?.file_url)}
                            alt={item.media_details?.filename || item.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.media_details?.analysis_status === 'completed' && item.media_details?.analysis_id ? (
                        <Textarea
                          value={editedDescriptions[item.media] ?? item.media_details?.analysis_description ?? ''}
                          onChange={(e) => handleUpdateDescription(item.media, e.target.value)}
                          className="min-h-[80px] text-sm"
                          placeholder="输入描述..."
                          disabled={savingDescriptions[item.media]}
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground italic p-2 bg-muted/50 rounded">
                          {item.media_details?.analysis_status === 'pending' && '等待分析...'}
                          {item.media_details?.analysis_status === 'processing' && '正在分析中...'}
                          {item.media_details?.analysis_status === 'failed' && '分析失败'}
                          {!item.media_details?.analysis_status && '未分析'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.media_details?.analysis_status === 'completed' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          已完成
                        </Badge>
                      )}
                      {item.media_details?.analysis_status === 'pending' && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          待处理
                        </Badge>
                      )}
                      {item.media_details?.analysis_status === 'processing' && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          分析中
                        </Badge>
                      )}
                      {item.media_details?.analysis_status === 'failed' && (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                          <X className="h-3 w-3 mr-1" />
                          失败
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.media_details?.analysis_status === 'completed' && item.media_details?.analysis_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveDescription(item)}
                          disabled={savingDescriptions[item.media]}
                        >
                          {savingDescriptions[item.media] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDescriptionsOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
