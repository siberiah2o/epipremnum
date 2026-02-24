import type { APIResponse, PaginatedResponse, Category, Media, Project, ProjectMedia, PaginationInfo, CreateProjectRequest, UpdateProjectRequest, AddMediaRequest, RemoveMediaRequest, BatchRemoveMediaRequest, ReorderMediaRequest, UpdateMediaNotesRequest } from './types';

const TIMEOUT = Number(process.env.NEXT_PUBLIC_API_TIMEOUT) || 30000;

// ============ Token 刷新管理 ============
// Token 刷新锁，防止并发刷新
let isRefreshing = false;
let refreshSubscribers: Array<(success: boolean) => void> = [];

function subscribeTokenRefresh(callback: (success: boolean) => void) {
  refreshSubscribers.push(callback);
}

function notifyTokenRefreshed(success: boolean) {
  refreshSubscribers.forEach(callback => callback(success));
  refreshSubscribers = [];
}

// 刷新 token - 通过 Next.js API 路由（从 Cookie 自动读取）
async function refreshAccessToken(): Promise<boolean> {
  // 如果正在刷新，等待刷新完成
  if (isRefreshing) {
    return new Promise((resolve) => {
      subscribeTokenRefresh((success) => resolve(success));
    });
  }

  isRefreshing = true;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // 自动携带 Cookie
    });

    const success = response.ok;
    notifyTokenRefreshed(success);
    return success;
  } catch (error) {
    console.error('Token refresh failed:', error);
    notifyTokenRefreshed(false);
    return false;
  } finally {
    isRefreshing = false;
  }
}

// ============ 核心 API 请求 ============

export interface ApiRequestOptions extends RequestInit {
  timeout?: number;
  skipAuth?: boolean;
  skipRefreshRetry?: boolean;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<APIResponse<T>> {
  const { timeout = TIMEOUT, skipAuth = false, skipRefreshRetry = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      ...fetchOptions,
      headers,
      credentials: 'include', // 自动携带 Cookie
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 解析响应
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // 处理 401，尝试刷新 token 并重试（只重试一次）
    if (response.status === 401 && !skipAuth && !skipRefreshRetry) {
      const refreshSuccess = await refreshAccessToken();
      if (refreshSuccess) {
        // 重试原请求
        const retryResponse = await fetch(endpoint, {
          ...fetchOptions,
          headers,
          credentials: 'include',
          signal: controller.signal,
        });

        const retryContentType = retryResponse.headers.get('content-type');
        const retryData = retryContentType && retryContentType.includes('application/json')
          ? await retryResponse.json()
          : await retryResponse.text();

        return retryData;
      }
    }

    return data;

  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      return { code: 408, message: '请求超时', data: null };
    }

    return {
      code: 500,
      message: error instanceof Error ? error.message : '网络请求失败',
      data: null
    };
  }
}

// ============ 认证工具 ============
// 注意：token 现在存储在 HttpOnly Cookie 中，客户端无法直接访问
// 认证状态通过 API 调用来判断

export const authUtils = {
  refreshAccessToken,
};

// ============ 便捷 HTTP 方法 ============

export const api = {
  get: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, data?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: <T = any>(endpoint: string, data?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  patch: <T = any>(endpoint: string, data?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: <T = any>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

// ============ 认证相关 API ============

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access: string; refresh: string; user: any }>('/api/auth/login', { email, password }, { skipAuth: true }),

  register: (data: {
    email: string;
    username: string;
    password: string;
    password_confirm: string;
    phone?: string;
  }) => api.post<any>('/api/auth/register', data, { skipAuth: true }),

  logout: () => api.post('/api/auth/logout'),
};

// ============ 用户相关 API ============

export const userApi = {
  getProfile: () => api.get<any>('/api/users/profile'),

  updateProfile: (data: { username?: string; phone?: string; avatar?: string }) =>
    api.patch<any>('/api/users/profile', data),

  updatePassword: (data: {
    old_password: string;
    new_password: string;
    new_password_confirm: string;
  }) => api.post('/api/users/update-password', data),

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch('/api/users/avatar/upload', {
        method: 'POST',
        credentials: 'include', // 自动携带 Cookie
        body: formData,
      });
      return await response.json();
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : '网络请求失败',
        data: null
      };
    }
  },

  deleteAvatar: () => api.delete<any>('/api/users/avatar/delete'),
};

// ============ 媒体相关 API ============

export const mediaApi = {
  // 上传媒体文件
  uploadMedia: async (file: File, category?: string | null, tags?: string[]) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);

    if (category) {
      formData.append('category_name', category);
    }
    if (tags && tags.length > 0) {
      formData.append('tag_names', JSON.stringify(tags));
    }

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return await response.json();
  },

  // 获取媒体列表
  getMediaList: () => api.get<any[]>('/api/media/'),

  // 获取单个媒体
  getMedia: (id: number) => api.get<any>(`/api/media/${id}/`),

  // 更新媒体信息
  updateMedia: (id: number, data: {
    filename?: string;
    category_name?: string | null;
    tag_names?: string[];
  }) => api.patch<any>(`/api/media/${id}/`, data),

  // 删除媒体
  deleteMedia: (id: number) => api.delete<any>(`/api/media/${id}/`),

  // 获取所有图片
  getImages: (params?: {
    search?: string;
    category?: number;
    type?: string;
    page?: number;
    page_size?: number;
    ordering?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.category) searchParams.set('category', params.category.toString());
    if (params?.type) searchParams.set('type', params.type);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
    if (params?.ordering) searchParams.set('ordering', params.ordering);
    const query = searchParams.toString();
    return api.get<Media[] | PaginatedResponse<Media>>(`/api/media/images/${query ? `?${query}` : ''}`);
  },
};

// ============ 分类相关 API ============

export const categoryApi = {
  // 获取分类列表（分页）
  getCategories: () =>
    api.get<PaginatedResponse<Category>>('/api/categories/'),

  // 创建分类
  createCategory: (data: { name: string; description?: string }) =>
    api.post<Category>('/api/categories/', data),

  // 更新分类
  updateCategory: (id: number, data: { name?: string; description?: string }) =>
    api.patch<Category>(`/api/categories/${id}/`, data),

  // 删除分类
  deleteCategory: (id: number) => api.delete<any>(`/api/categories/${id}/`),
};

// ============ LLM 相关 API ============

export const llmApi = {
  // ============ 端点管理 ============
  // 获取端点列表
  getEndpoints: () => api.get<any[]>('/api/llm/endpoints/'),

  // 创建端点
  createEndpoint: (data: { name: string; provider_type: string; base_url: string; api_key: string }) =>
    api.post<any>('/api/llm/endpoints/', data),

  // 更新端点
  updateEndpoint: (id: number, data: { name?: string; provider_type?: string; base_url?: string; api_key?: string }) =>
    api.patch<any>(`/api/llm/endpoints/${id}/`, data),

  // 删除端点
  deleteEndpoint: (id: number) => api.delete<any>(`/api/llm/endpoints/${id}/`),

  // 获取端点的可用模型列表（从远程 API 获取）
  getAvailableModels: (id: number) =>
    api.get<{ models: string[]; endpoint_id: number; endpoint_name: string; provider_type: string }>(
      `/api/llm/endpoints/${id}/available_models/`
    ),

  // 同步端点的可用模型（仅 Ollama 支持）
  syncEndpointModels: (id: number) =>
    api.post<{ synced: number; total: number; models: string[]; message: string }>(
      `/api/llm/endpoints/${id}/sync_models/`
    ),

  // 设置默认端点
  setDefaultEndpoint: (id: number) =>
    api.post<{ id: number; name: string; is_default: boolean; message: string }>(
      `/api/llm/endpoints/${id}/set_default/`
    ),

  // ============ 模型管理 ============
  // 获取模型列表
  getModels: () => api.get<any[]>('/api/llm/models/'),

  // 创建模型
  createModel: (data: { endpoint: number; name: string }) =>
    api.post<any>('/api/llm/models/', data),

  // 更新模型
  updateModel: (id: number, data: { endpoint?: number; name?: string }) =>
    api.patch<any>(`/api/llm/models/${id}/`, data),

  // 删除模型
  deleteModel: (id: number) => api.delete<any>(`/api/llm/models/${id}/`),

  // 设置/取消默认模型
  setDefaultModel: (id: number) => api.post<any>(`/api/llm/models/${id}/set_default/`),
};

// ============ LLM 任务管理 API ============

export const llmTaskApi = {
  // 获取任务列表
  getTasks: (params?: { limit?: number; offset?: number; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return api.get<any>(`/api/llm/tasks/${query ? `?${query}` : ''}`);
  },

  // 创建分析任务
  createTask: (data: { media_id: number; model_id: number }) =>
    api.post<any>('/api/llm/tasks/', data),

  // 获取任务详情
  getTask: (id: number) => api.get<any>(`/api/llm/tasks/${id}/`),

  // 删除任务记录
  deleteTask: (id: number) => api.delete<any>(`/api/llm/tasks/${id}/`),

  // 创建批量分析任务
  createBatchTask: (data: { media_ids: number[]; model_id: number }) =>
    api.post<any>('/api/llm/tasks/batch/', data),

  // 创建模型同步任务
  createSyncTask: (data: { endpoint_id: number }) =>
    api.post<any>('/api/llm/tasks/sync/', data),

  // 获取任务组状态
  getTaskGroup: (group: string) => api.get<any>(`/api/llm/tasks/group/?group=${group}`),

  // 获取任务统计信息
  getTaskStats: () => api.get<any>('/api/llm/tasks/stats/'),
};

// ============ LLM 图片分析 API ============

export const llmAnalysisApi = {
  // 获取分析列表
  getAnalyses: (params?: {
    status?: string;
    media?: number;
    model?: number;
    error_type?: string;
    search?: string;
    ordering?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.media) searchParams.set('media', params.media.toString());
    if (params?.model) searchParams.set('model', params.model.toString());
    if (params?.error_type) searchParams.set('error_type', params.error_type);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.ordering) searchParams.set('ordering', params.ordering);
    const query = searchParams.toString();
    return api.get<any>(`/api/llm/analyses/${query ? `?${query}` : ''}`);
  },

  // 创建分析任务（异步）
  createAnalysis: (data: { media_id: number; model_id: number }) =>
    api.post<any>('/api/llm/analyses/', data),

  // 获取分析详情
  getAnalysis: (id: number) => api.get<any>(`/api/llm/analyses/${id}/`),

  // 删除分析记录
  deleteAnalysis: (id: number) => api.delete<any>(`/api/llm/analyses/${id}/`),

  // 重试分析
  retryAnalysis: (id: number) => api.post<any>(`/api/llm/analyses/${id}/retry/`),

  // 取消分析任务
  cancelAnalysis: (id: number) => api.post<any>(`/api/llm/analyses/${id}/cancel/`),

  // 更新分析描述
  updateDescription: (id: number, description: string) =>
    api.patch<any>(`/api/llm/analyses/${id}/update_description/`, { description }),

  // 获取分析统计信息
  getAnalysisStats: () => api.get<any>('/api/llm/analyses/stats/'),

  // 根据媒体ID获取分析记录
  getAnalysesByMedia: (mediaId: number) => api.get<any>(`/api/llm/analyses/by-media/?media_id=${mediaId}`),

  // 批量重试失败的分析任务
  batchRetryAnalyses: (data: { analysis_ids?: number[] }) =>
    api.post<any>('/api/llm/analyses/batch-retry/', data),

  // 批量取消分析任务
  batchCancelAnalyses: (data: { analysis_ids: number[] }) =>
    api.post<any>('/api/llm/analyses/batch-cancel/', data),
};

// ============ 项目库相关 API ============

export const projectApi = {
  // 获取项目列表（分页）
  getProjects: (params?: { page?: number; page_size?: number; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.page_size) searchParams.set('page_size', params.page_size.toString());
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return api.get<any>(`/api/projects/${query ? `?${query}` : ''}`);
  },

  // 创建项目
  createProject: (data: CreateProjectRequest) =>
    api.post<Project>('/api/projects/', data),

  // 获取项目详情
  getProject: (id: number) => api.get<Project>(`/api/projects/${id}/`),

  // 更新项目
  updateProject: (id: number, data: UpdateProjectRequest) =>
    api.put<Project>(`/api/projects/${id}/`, data),

  // 删除项目
  deleteProject: (id: number) => api.delete<any>(`/api/projects/${id}/`),

  // 获取项目中的媒体
  getProjectMedia: (id: number) => api.get<ProjectMedia[]>(`/api/projects/${id}/media/`),

  // 添加媒体到项目
  addMedia: (id: number, data: AddMediaRequest) =>
    api.post<any>(`/api/projects/${id}/media/add/`, data),

  // 移除单个媒体
  removeMedia: (id: number, data: RemoveMediaRequest) =>
    api.post<any>(`/api/projects/${id}/media/remove/`, data),

  // 批量移除媒体
  batchRemoveMedia: (id: number, data: BatchRemoveMediaRequest) =>
    api.post<any>(`/api/projects/${id}/media/batch-remove/`, data),

  // 重新排序媒体
  reorderMedia: (id: number, data: ReorderMediaRequest) =>
    api.post<any>(`/api/projects/${id}/media/reorder/`, data),

  // 更新媒体备注
  updateMediaNotes: (id: number, data: UpdateMediaNotesRequest) =>
    api.post<any>(`/api/projects/${id}/media/update-notes/`, data),

  // 获取可添加的媒体
  getAvailableMedia: (params?: { search?: string; category?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.category) searchParams.set('category', params.category);
    const query = searchParams.toString();
    return api.get<Media[]>(`/api/projects/available-media/${query ? `?${query}` : ''}`);
  },

  // 获取导出统计
  getExportStats: (id: number) =>
    api.get<{ total: number; exportable: number; no_analysis: number; analysis_incomplete: number }>(
      `/api/projects/${id}/export_stats/`
    ),

  // 导出 LoRA 训练数据集
  exportLoraDataset: async (id: number, triggerWord?: string): Promise<void> => {
    const url = triggerWord
      ? `/api/projects/${id}/export_lora_dataset/?trigger_word=${encodeURIComponent(triggerWord)}`
      : `/api/projects/${id}/export_lora_dataset/`;

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '导出失败');
    }

    // 获取文件名
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'lora_dataset.zip';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) {
        filename = match[1];
      }
    }

    // 下载文件
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  },
};
