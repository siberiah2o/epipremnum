'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { llmAnalysisApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { TasksHeader } from './components/tasks-header';
import { GridView } from './components/grid-view';
import { ListView } from './components/list-view';
import { AnalysisDetailDialog, type ImageAnalysis } from './components/analysis-detail-dialog';
import { MediaGridSkeleton } from '@/components/common/loading-skeleton';

type ViewMode = 'grid' | 'list';

interface AnalysisStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export default function TasksPage() {
  // 分析数据
  const [analyses, setAnalyses] = useState<ImageAnalysis[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<ImageAnalysis[]>([]);
  const [stats, setStats] = useState<AnalysisStats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // 对话框状态
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<ImageAnalysis | null>(null);

  // 按钮加载状态
  const [retryingIds, setRetryingIds] = useState<Set<number>>(new Set());

  // 获取文件 URL
  const getFileUrl = (path: string) => {
    if (!path) return '';
    return `/api/media/file/${path.replace('upload/', '')}`;
  };

  // 计算分页数据
  const totalPages = Math.ceil(filteredAnalyses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAnalyses = useMemo(
    () => filteredAnalyses.slice(startIndex, endIndex),
    [filteredAnalyses, startIndex, endIndex]
  );

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        llmAnalysisApi.getAnalyses({}),
        llmAnalysisApi.getAnalysisStats(),
      ]);

      if (listRes.code === 200) {
        setAnalyses(listRes.data || []);
      }
      if (statsRes.code === 200) {
        setStats(statsRes.data || {
          total: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load analyses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 过滤数据
  useEffect(() => {
    let filtered = analyses;

    // 搜索过滤
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.media_filename?.toLowerCase().includes(lowerQuery) ||
        a.description?.toLowerCase().includes(lowerQuery) ||
        a.media_category?.name?.toLowerCase().includes(lowerQuery)
      );
    }

    // 状态过滤
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    setFilteredAnalyses(filtered);
    setCurrentPage(1);
  }, [analyses, searchQuery, statusFilter]);

  // 轮询更新: 当有活跃任务时每 5 秒更新一次
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const hasActiveTasks = stats.pending > 0 || stats.processing > 0;

    if (hasActiveTasks && !refreshing) {
      pollingIntervalRef.current = setInterval(() => {
        loadData();
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [stats.pending, stats.processing, refreshing, loadData]);

  // 刷新数据 - 连续轮询模式
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleRefresh = useCallback(() => {
    if (refreshing) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      setRefreshing(false);
      return;
    }

    setRefreshing(true);
    loadData();

    refreshIntervalRef.current = setInterval(() => {
      loadData();
    }, 1000);
  }, [refreshing, loadData]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // 查看分析详情
  const handleViewDetail = (analysis: ImageAnalysis) => {
    setSelectedAnalysis(analysis);
    setAnalysisDialogOpen(true);
  };

  // 重试/开始分析
  const handleRetry = async (analysis: ImageAnalysis) => {
    if (retryingIds.has(analysis.id)) return;

    setRetryingIds(prev => new Set(prev).add(analysis.id));

    const prevAnalyses = [...analyses];
    const prevStats = { ...stats };
    const updatedAnalyses = analyses.map(a =>
      a.id === analysis.id
        ? { ...a, status: 'pending' as const }
        : a
    );
    setAnalyses(updatedAnalyses);

    if (analysis.status === 'failed') {
      setStats(prev => ({
        ...prev,
        failed: Math.max(0, prev.failed - 1),
        pending: prev.pending + 1,
      }));
    } else if (analysis.status === 'completed') {
      setStats(prev => ({
        ...prev,
        completed: Math.max(0, prev.completed - 1),
        pending: prev.pending + 1,
      }));
    }

    try {
      const isPending = analysis.status === 'pending';
      const isCompleted = analysis.status === 'completed';
      const res = await llmAnalysisApi.retryAnalysis(analysis.id);

      if (res.code === 200 && res.data?.status === 'pending') {
        toast.info('任务已在队列中等待处理');
      } else {
        if (isCompleted) {
          toast.success('已开始重新分析');
        } else {
          toast.success(isPending ? '已开始分析' : '重试成功');
        }
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || error?.message || '操作失败';
      toast.error(errorMsg);
      setAnalyses(prevAnalyses);
      setStats(prevStats);
    } finally {
      setRetryingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(analysis.id);
        return newSet;
      });
    }
  };

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
      <TasksHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        stats={stats}
        filteredCount={filteredAnalyses.length}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        startIndex={startIndex}
        endIndex={endIndex}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* 内容区域 */}
      {viewMode === 'grid' ? (
        <GridView
          analyses={paginatedAnalyses}
          getFileUrl={getFileUrl}
          onViewDetail={handleViewDetail}
          onRetry={handleRetry}
          retryingIds={retryingIds}
        />
      ) : (
        <ListView
          analyses={paginatedAnalyses}
          getFileUrl={getFileUrl}
          onViewDetail={handleViewDetail}
          onRetry={handleRetry}
          retryingIds={retryingIds}
        />
      )}

      {/* 分析详情对话框 */}
      <AnalysisDetailDialog
        open={analysisDialogOpen}
        onOpenChange={setAnalysisDialogOpen}
        analysis={selectedAnalysis}
      />
    </div>
  );
}
