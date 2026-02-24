/**
 * SWR 数据获取配置
 * 提供统一的 fetcher 和 SWR 配置
 */

import useSWR, { SWRConfiguration, SWRResponse, mutate } from 'swr';
import { apiRequest } from './api-client';

/**
 * 通用 SWR fetcher
 * 使用项目的 apiRequest 进行请求，自动处理认证和 token 刷新
 */
export async function fetcher<T>(url: string): Promise<T> {
  const response = await apiRequest<T>(url);
  if (response.code !== 200 && response.code !== 201) {
    throw new Error(response.message || '请求失败');
  }
  return response.data as T;
}

/**
 * 默认 SWR 配置
 */
export const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: false,
  dedupingInterval: 5000,
};

/**
 * 带认证的 SWR Hook
 */
export function useSWRWithAuth<T = any, E = Error>(
  key: string | null,
  config?: SWRConfiguration
): SWRResponse<T, E> {
  return useSWR<T, E>(key, fetcher, {
    ...defaultConfig,
    ...config,
  });
}

/**
 * 预取数据
 */
export function prefetch<T>(key: string): Promise<T> {
  return fetcher<T>(key).then((data) => {
    mutate(key, data, false);
    return data;
  });
}

/**
 * 刷新所有缓存
 */
export function refreshAll() {
  mutate(() => true, undefined, { revalidate: true });
}

/**
 * 刷新匹配 key 的缓存
 */
export function refreshByKey(pattern: string | RegExp) {
  mutate(
    (key) => {
      if (typeof key === 'string') {
        if (typeof pattern === 'string') {
          return key.includes(pattern);
        }
        return pattern.test(key);
      }
      return false;
    },
    undefined,
    { revalidate: true }
  );
}

// ============ 预定义的 SWR Hooks ============

/**
 * 获取媒体列表
 */
export function useMediaList(options?: {
  search?: string;
  category?: number;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.category) params.set('category', options.category.toString());
  if (options?.page) params.set('page', options.page.toString());
  if (options?.pageSize) params.set('page_size', options.pageSize.toString());

  const query = params.toString();
  const key = query ? `/api/media/images/?${query}` : '/api/media/images/';

  return useSWRWithAuth<any>(key);
}

/**
 * 获取分类列表
 */
export function useCategories() {
  return useSWRWithAuth<any>('/api/categories/');
}

/**
 * 获取 LLM 模型列表
 */
export function useLLMModels() {
  return useSWRWithAuth<any>('/api/llm/models/');
}

/**
 * 获取 LLM 端点列表
 */
export function useLLMEndpoints() {
  return useSWRWithAuth<any>('/api/llm/endpoints/');
}

/**
 * 获取分析列表
 */
export function useAnalyses(options?: {
  status?: string;
  media?: number;
  model?: number;
}) {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.media) params.set('media', options.media.toString());
  if (options?.model) params.set('model', options.model.toString());

  const query = params.toString();
  const key = query ? `/api/llm/analyses/?${query}` : '/api/llm/analyses/';

  return useSWRWithAuth<any>(key, {
    refreshInterval: 5000, // 每 5 秒刷新，用于更新分析状态
  });
}

/**
 * 获取项目列表
 */
export function useProjects(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', options.page.toString());
  if (options?.pageSize) params.set('page_size', options.pageSize.toString());
  if (options?.search) params.set('search', options.search);

  const query = params.toString();
  const key = query ? `/api/projects/?${query}` : '/api/projects/';

  return useSWRWithAuth<any>(key);
}

/**
 * 获取项目详情
 */
export function useProject(id: number | null) {
  return useSWRWithAuth<any>(id ? `/api/projects/${id}/` : null);
}

/**
 * 获取用户资料
 */
export function useProfile() {
  return useSWRWithAuth<any>('/api/users/profile');
}
