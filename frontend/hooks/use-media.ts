/**
 * 媒体数据获取 Hook
 */
import { useState, useEffect, useCallback } from 'react';
import { mediaApi } from '@/lib/api-client';
import { extractPaginatedData, extractPaginationInfo } from '@/lib/types';
import type { Media } from '@/lib/types';

export interface UseMediaOptions {
  /** 是否自动加载 */
  autoLoad?: boolean;
  /** 搜索关键词 */
  search?: string;
  /** 分类ID */
  categoryId?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 页码 */
  page?: number;
  /** 排序字段 */
  ordering?: string;
}

export interface UseMediaReturn {
  /** 媒体列表 */
  media: Media[];
  /** 加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 总数 */
  total: number;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 是否还有更多数据 */
  hasMore: boolean;
}

export function useMedia(options: UseMediaOptions = {}): UseMediaReturn {
  const {
    autoLoad = true,
    search = '',
    categoryId,
    pageSize = 20,
    page = 1,
    ordering = '-created_at',
  } = options;

  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);

  const loadData = useCallback(async (pageNum: number = currentPage, append: boolean = false) => {
    if (!append) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await mediaApi.getImages({
        search: search || undefined,
        category: categoryId,
        page: pageNum,
        page_size: pageSize,
        ordering,
      });

      if (response.code === 200) {
        const data = extractPaginatedData<Media>(response);
        if (append) {
          setMedia((prev) => [...prev, ...data]);
        } else {
          setMedia(data);
        }
        const pagination = extractPaginationInfo(response);
        setTotal(pagination?.count || data.length);
        setCurrentPage(pageNum);
      } else {
        setError(response.message || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, pageSize, ordering, currentPage]);

  const refresh = useCallback(async () => {
    setCurrentPage(1);
    await loadData(1, false);
  }, [loadData]);

  const loadMore = useCallback(async () => {
    const nextPage = currentPage + 1;
    await loadData(nextPage, true);
  }, [loadData, currentPage]);

  // 初始加载
  useEffect(() => {
    if (autoLoad) {
      loadData(1, false);
    }
  }, [autoLoad, search, categoryId, ordering]); // 注意：不包含 loadData

  const hasMore = media.length < total;

  return {
    media,
    loading,
    error,
    total,
    refresh,
    loadMore,
    hasMore,
  };
}

/**
 * 单个媒体详情 Hook
 */
export function useMediaDetail(mediaId: number | null) {
  const [media, setMedia] = useState<Media | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaId) {
      setMedia(null);
      return;
    }

    const loadDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await mediaApi.getMedia(mediaId);
        if (response.code === 200) {
          setMedia(response.data);
        } else {
          setError(response.message || '加载失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '网络错误');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [mediaId]);

  return { media, loading, error };
}
