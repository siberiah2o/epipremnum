'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { mediaApi, categoryApi, llmApi, llmAnalysisApi } from '@/lib/api-client';
import { formatFileSize, getFileUrl, batchExecute } from '@/lib/utils';
import { extractPaginatedData } from '@/lib/types';
import { toast } from 'sonner';
import type { Media, Category, ImageAnalysis } from '@/lib/types';
import { MediaHeader } from './components/media-header';
import { GridView } from './components/grid-view';
import { ListView } from './components/list-view';
import { MediaDetailDialog } from './components/media-detail-dialog';
import { DeleteDialog } from './components/delete-dialog';
import { MediaGridSkeleton } from '@/components/common/loading-skeleton';

type ViewMode = 'grid' | 'list';

interface AIModel {
  id: number;
  name: string;
  endpoint: number;
  is_default: boolean;
}

export default function MediaListPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 数据状态
  const [media, setMedia] = useState<Media[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<Media[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Map<string, number>>(new Map());
  const [analysisMap, setAnalysisMap] = useState<Map<number, ImageAnalysis>>(new Map());

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);

  // 对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<Media | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Media | null>(null);

  // AI 分析相关状态
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<number | null>(null);
  const [analyzingItems, setAnalyzingItems] = useState<Set<number>>(new Set());

  // 批量选择状态
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);

  // 计算分页数据
  const totalPages = Math.ceil(filteredMedia.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMedia = useMemo(
    () => filteredMedia.slice(startIndex, endIndex),
    [filteredMedia, startIndex, endIndex]
  );

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const mediaRes = await mediaApi.getImages();
      const [categoriesRes, analysesRes] = await Promise.all([
        categoryApi.getCategories(),
        llmAnalysisApi.getAnalyses(),
      ]);

      if (mediaRes.code === 200) {
        const mediaData = extractPaginatedData<Media>(mediaRes);
        setMedia(mediaData);
        setFilteredMedia(mediaData);

        // 计算分类的数量统计
        const catCounts = new Map<string, number>();
        mediaData.forEach((m: Media) => {
          if (m.category_name) {
            catCounts.set(m.category_name, (catCounts.get(m.category_name) || 0) + 1);
          }
        });
        setCategoryCounts(catCounts);
      }

      if (categoriesRes.code === 200) {
        const categoriesData = extractPaginatedData<Category>(categoriesRes);
        setCategories(categoriesData);
      }

      if (analysesRes.code === 200) {
        // 构建分析状态映射 (media_id -> latest analysis)
        const analysisData = analysesRes.data || [];
        const map = new Map<number, ImageAnalysis>();
        analysisData.forEach((a: ImageAnalysis) => {
          const existing = map.get(a.media);
          if (!existing || new Date(a.created_at) > new Date(existing.created_at)) {
            map.set(a.media, a);
          }
        });
        setAnalysisMap(map);

        // 更新媒体列表中的分析状态
        if (mediaRes.code === 200) {
          const mediaData = extractPaginatedData<Media>(mediaRes);
          const mediaWithAnalysis = mediaData.map((m: Media) => {
            const analysis = map.get(m.id);
            return {
              ...m,
              analysis_status: analysis?.status || null,
              analysis_description: analysis?.description || null,
            };
          });
          setMedia(mediaWithAnalysis);
          setFilteredMedia(mediaWithAnalysis);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载 AI 模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await llmApi.getModels();
        if (res.code === 200) {
          const modelsList = res.data || [];
          setModels(modelsList);
          // 设置默认模型
          const defaultModel = modelsList.find((m: AIModel) => m.is_default);
          setSelectedModel(defaultModel?.id || modelsList[0]?.id || null);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, []);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 过滤媒体
  useEffect(() => {
    let filtered = media;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.filename.toLowerCase().includes(lowerQuery) ||
        (m.analysis_description?.toLowerCase().includes(lowerQuery) ?? false) ||
        (m.category_name?.toLowerCase().includes(lowerQuery) ?? false)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(m => m.category_name === selectedCategory);
    }

    setFilteredMedia(filtered);
    setCurrentPage(1);
  }, [media, searchQuery, selectedCategory]);

  // 删除媒体
  const handleDelete = async () => {
    if (!mediaToDelete) return;

    setDeleting(true);
    try {
      await mediaApi.deleteMedia(mediaToDelete.id);
      setMedia(prev => prev.filter(m => m.id !== mediaToDelete.id));
      toast.success('删除成功');
      setDeleteDialogOpen(false);
      setMediaToDelete(null);
    } catch (error) {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  // 处理文件选择 - 使用批量上传
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const imageFiles = selectedFiles.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      toast.error('请选择图片文件');
      return;
    }

    setUploading(true);

    // 使用批量上传工具函数
    const result = await batchExecute(
      imageFiles,
      async (file) => {
        await mediaApi.uploadMedia(file, null, []);
      },
      3 // 并发数限制为3
    );

    setUploading(false);

    if (result.successCount > 0) {
      toast.success(`成功上传 ${result.successCount} 张图片`);
      loadData();
    }
    if (result.failureCount > 0) {
      toast.error(`${result.failureCount} 张图片上传失败`);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 查看详情
  const handleViewDetail = (item: Media) => {
    setSelectedItem(item);
    setDetailDialogOpen(true);
  };

  // 删除点击
  const handleDeleteClick = (item: Media) => {
    setMediaToDelete(item);
    setDeleteDialogOpen(true);
  };

  // AI 分析点击
  const handleAnalyzeClick = async (item: Media) => {
    if (!selectedModel) {
      toast.error('请先在设置中配置 AI 模型');
      return;
    }

    // 添加到分析中集合
    setAnalyzingItems(prev => new Set(prev).add(item.id));

    try {
      const res = await llmAnalysisApi.createAnalysis({
        media_id: item.id,
        model_id: selectedModel,
      });

      if (res.code === 201) {
        toast.success('分析任务已创建');
        // 刷新分析状态
        setTimeout(() => loadData(), 1000);
      } else {
        toast.error(res.message || '创建分析任务失败');
      }
    } catch (error) {
      toast.error('创建分析任务失败');
    } finally {
      // 延迟移除 loading 状态，给用户反馈
      setTimeout(() => {
        setAnalyzingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });
      }, 500);
    }
  };

  // 切换选择模式
  const handleToggleSelectMode = () => {
    setIsSelectMode(prev => !prev);
    setSelectedItems(new Set());
  };

  // 切换单个项选择
  const handleToggleItem = (id: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 全选当前页
  const handleSelectAll = () => {
    const allSelected = paginatedMedia.every(item => selectedItems.has(item.id));
    if (allSelected) {
      // 取消全选
      setSelectedItems(new Set());
    } else {
      // 全选当前页
      setSelectedItems(new Set(paginatedMedia.map(item => item.id)));
    }
  };

  // 批量分析 - 使用批量执行工具函数
  const handleBatchAnalyze = async () => {
    if (!selectedModel) {
      toast.error('请先在设置中配置 AI 模型');
      return;
    }

    if (selectedItems.size === 0) {
      toast.error('请先选择要分析的图片');
      return;
    }

    setBatchAnalyzing(true);

    const itemsArray = Array.from(selectedItems);
    const result = await batchExecute(
      itemsArray,
      async (id) => {
        const res = await llmAnalysisApi.createAnalysis({
          media_id: id,
          model_id: selectedModel!,
        });
        if (res.code !== 201) {
          throw new Error(res.message || '创建失败');
        }
        return res;
      },
      3 // 并发数限制为3
    );

    setBatchAnalyzing(false);
    setIsSelectMode(false);
    setSelectedItems(new Set());

    if (result.successCount > 0) {
      toast.success(`成功创建 ${result.successCount} 个分析任务`);
      setTimeout(() => loadData(), 1000);
    }
    if (result.failureCount > 0) {
      toast.error(`${result.failureCount} 个任务创建失败`);
    }
  };

  // 轮询刷新进行中的分析
  useEffect(() => {
    const hasProcessing = media.some(m =>
      m.analysis_status === 'pending' || m.analysis_status === 'processing'
    );

    if (hasProcessing) {
      const interval = setInterval(() => {
        loadData();
      }, 3000); // 每3秒刷新一次

      return () => clearInterval(interval);
    }
  }, [media, loadData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-muted animate-pulse rounded-md w-1/3" />
        <MediaGridSkeleton count={12} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <MediaHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categories}
        categoryCounts={categoryCounts}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        uploading={uploading}
        onUploadClick={() => fileInputRef.current?.click()}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        filteredCount={filteredMedia.length}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        startIndex={startIndex}
        endIndex={endIndex}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        isSelectMode={isSelectMode}
        selectedCount={selectedItems.size}
        paginatedMedia={paginatedMedia}
        selectedItems={selectedItems}
        batchAnalyzing={batchAnalyzing}
        onToggleSelectMode={handleToggleSelectMode}
        onSelectAll={handleSelectAll}
        onBatchAnalyze={handleBatchAnalyze}
      />

      {/* 内容区域 */}
      {viewMode === 'grid' ? (
        <GridView
          media={paginatedMedia}
          totalCount={media.length}
          getFileUrl={getFileUrl}
          formatFileSize={formatFileSize}
          onViewDetail={handleViewDetail}
          onDeleteClick={handleDeleteClick}
          onAnalyzeClick={handleAnalyzeClick}
          analyzingItems={analyzingItems}
          isSelectMode={isSelectMode}
          selectedItems={selectedItems}
          onToggleItem={handleToggleItem}
        />
      ) : (
        <ListView
          media={paginatedMedia}
          totalCount={media.length}
          getFileUrl={getFileUrl}
          formatFileSize={formatFileSize}
          onViewDetail={handleViewDetail}
          onDeleteClick={handleDeleteClick}
          onAnalyzeClick={handleAnalyzeClick}
          analyzingItems={analyzingItems}
          isSelectMode={isSelectMode}
          selectedItems={selectedItems}
          onToggleItem={handleToggleItem}
          startIndex={startIndex}
        />
      )}

      {/* 删除确认对话框 */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        mediaToDelete={mediaToDelete}
        onConfirm={handleDelete}
        deleting={deleting}
      />

      {/* 详情对话框 */}
      <MediaDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        currentItem={selectedItem}
        allItems={filteredMedia}
        setCurrentItem={setSelectedItem}
        getFileUrl={getFileUrl}
        formatFileSize={formatFileSize}
      />
    </div>
  );
}
