/**
 * 分类数据获取 Hook
 */
import { useState, useEffect, useCallback } from 'react';
import { categoryApi } from '@/lib/api-client';
import { extractPaginatedData } from '@/lib/types';
import type { Category } from '@/lib/types';

export interface UseCategoriesOptions {
  /** 是否自动加载 */
  autoLoad?: boolean;
  /** 搜索关键词 */
  search?: string;
}

export interface UseCategoriesReturn {
  /** 分类列表 */
  categories: Category[];
  /** 加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 创建分类 */
  createCategory: (name: string, description?: string) => Promise<Category | null>;
  /** 更新分类 */
  updateCategory: (id: number, data: { name?: string; description?: string }) => Promise<boolean>;
  /** 删除分类 */
  deleteCategory: (id: number) => Promise<boolean>;
}

export function useCategories(options: UseCategoriesOptions = {}): UseCategoriesReturn {
  const { autoLoad = true, search = '' } = options;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await categoryApi.getCategories();
      if (response.code === 200) {
        const data = extractPaginatedData<Category>(response);
        setCategories(data);
      } else {
        setError(response.message || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const createCategory = useCallback(async (name: string, description?: string): Promise<Category | null> => {
    try {
      const response = await categoryApi.createCategory({ name, description });
      if ((response.code === 201 || response.code === 200) && response.data) {
        const newCategory = response.data;
        setCategories((prev) => [...prev, newCategory]);
        return newCategory;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const updateCategory = useCallback(async (
    id: number,
    data: { name?: string; description?: string }
  ): Promise<boolean> => {
    try {
      const response = await categoryApi.updateCategory(id, data);
      if (response.code === 200 && response.data) {
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? response.data! : c))
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const deleteCategory = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await categoryApi.deleteCategory(id);
      if (response.code === 200 || response.code === 204) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // 初始加载
  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
  }, [autoLoad, loadData]);

  return {
    categories,
    loading,
    error,
    refresh: loadData,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
