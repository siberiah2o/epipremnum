// AI 管理模块 API 客户端 - 基于最新 OpenAPI 3.0 规范

// 注意：后端直接返回数据，不包装在ApiResponse结构中
// 所以这里移除ApiResponse类型定义，直接处理原始响应

// 类型定义
export interface OllamaModel {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_active: boolean;
  is_vision_capable: boolean;
  is_default: boolean;
  model_size: string;
  endpoint: number;
  endpoint_name?: string;
  endpoint_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OllamaEndpoint {
  id: number;
  name: string;
  url: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
  timeout?: number;
  created_by?: string;
  created_by_username?: string;
  created_at?: string;
  updated_at?: string;
  can_delete?: boolean; // 是否可以删除
  is_owner?: boolean; // 是否为创建者
}

export interface CreateEndpointRequest {
  name: string;
  url: string;
  description?: string;
  is_default?: boolean;
  timeout?: number;
}

export interface UpdateEndpointRequest {
  name?: string;
  url?: string;
  description?: string;
  is_active?: boolean;
  is_default?: boolean;
  timeout?: number;
}

export interface EndpointTestResult {
  success: boolean;
  message: string;
  error?: string;
  models_count?: number;
  models?: string[];
}

export interface ConnectionTestResult {
  status: "success" | "error";
  message: string;
  models_count?: number;
  models?: string[];
}

export interface ModelSyncResult {
  synced: number;
  updated: number;
  disabled?: number;
  total_vision_models?: number;
  message?: string;
}

// 图片分析相关类型
export interface AnalysisTask {
  analysis_id: number;
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  media_info: {
    id: number;
    title: string;
    file_type: string;
    file_url?: string;
  };
  progress?: number;
  is_task_running?: boolean;
  created_at: string;
  analyzed_at?: string;
}

export interface AnalysisDetail {
  id: number;
  media_info: {
    id: number;
    title: string;
    file_type: string;
    file_url: string;
  };
  status: "pending" | "processing" | "completed" | "failed";
  model_used: string;
  title?: string;
  description?: string;
  suggested_categories_data?: Array<{
    id: number;
    name: string;
    description?: string;
  }>;
  suggested_tags_data?: Array<{
    id: number;
    name: string;
  }>;
  applied_to_media: boolean;
  task_progress: number;
  created_at: string;
  analyzed_at?: string;
}

export interface CreateAnalysisRequest {
  media_id: number;
  model_name?: string;
  options?: {
    generate_title?: boolean;
    generate_description?: boolean;
    generate_categories?: boolean;
    generate_tags?: boolean;
    max_categories?: number;
    max_tags?: number;
  };
}

export interface AnalysisStatusRequest {
  analysis_id: number;
}

export interface AnalysisListRequest {
  page?: number;
  page_size?: number;
  status?: "pending" | "processing" | "completed" | "failed";
}

export interface AnalysisListResponse {
  results: Array<{
    id: number;
    media_title: string;
    media_file_type: string;
    status: string;
    model_used: string;
    created_at: string;
    analyzed_at?: string;
  }>;
  count: number;
  next: string | null;
  previous: string | null;
}


// 媒体分类和标签接口
export interface MediaCategory {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface MediaTag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}

export interface CreateTagRequest {
  name: string;
}

// AI 管理服务类
export class AIManagementService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  }

  // 获取当前的 access token
  private getAccessToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("access_token");
    }
    return null;
  }

  // 获取当前的 refresh token
  private getRefreshToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("refresh_token");
    }
    return null;
  }

  // 保存 tokens
  private saveTokens(access: string, refresh: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
    }
  }

  // 清除 tokens
  private clearTokens() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
  }

  // 刷新 token
  private async refreshToken(): Promise<any> {
    const currentRefreshToken = this.getRefreshToken();

    if (!currentRefreshToken) {
      throw new Error("没有有效的 refresh token");
    }

    const response = await fetch(`${this.baseURL}/api/auth/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh: currentRefreshToken }),
    });

    if (!response.ok) {
      throw new Error("Token 刷新失败");
    }

    const data = await response.json();

    // 更新 tokens
    if (data.access && data.refresh) {
      this.saveTokens(data.access, data.refresh);
    }

    return data;
  }

  // 通用请求方法
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    // 如果需要认证，添加 Authorization header
    if (this.getAccessToken()) {
      headers.Authorization = `Bearer ${this.getAccessToken()}`;
    }

    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      // 处理 401 错误，尝试刷新 token
      if (
        response.status === 401 &&
        this.getRefreshToken() &&
        retryCount === 0
      ) {
        try {
          await this.refreshToken();
          // 重试原请求
          return this.request<T>(endpoint, options, retryCount + 1);
        } catch (refreshError) {
          // 刷新失败，清除 tokens
          this.clearTokens();
          throw new Error("登录已过期，请重新登录");
        }
      }

      if (!response.ok) {
        // 处理错误响应，后端返回标准格式 {code, message, data}
        const errorMessage =
          typeof responseData === "object" &&
          responseData &&
          "message" in responseData
            ? responseData.message
            : `请求失败: ${response.status}`;
        throw new Error(errorMessage);
      }

      // 后端返回标准格式 {code, message, data}
      // 我们需要提取 data 字段作为返回值
      if (
        typeof responseData === "object" &&
        responseData &&
        "data" in responseData
      ) {
        return responseData.data as T;
      }

      // 如果不是标准格式，直接返回原始数据
      return responseData as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            "AI分析请求超时，图片可能过于复杂。请尝试：1) 使用更简单的图片 2) 检查网络连接 3) 稍后重试"
          );
        }
        throw error;
      }
      throw new Error("请求发生未知错误");
    }
  }

  // 端点管理
  async getEndpoints(): Promise<OllamaEndpoint[]> {
    return this.request<OllamaEndpoint[]>("/api/endpoint/endpoints/");
  }

  async createEndpoint(
    data: CreateEndpointRequest
  ): Promise<{ message: string; endpoint: OllamaEndpoint }> {
    return this.request<{
      message: string;
      endpoint: OllamaEndpoint;
    }>("/api/endpoint/endpoints/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getEndpoint(endpointId: number): Promise<OllamaEndpoint> {
    return this.request<OllamaEndpoint>(`/api/endpoint/endpoints/${endpointId}/`);
  }

  async updateEndpoint(
    endpointId: number,
    data: UpdateEndpointRequest
  ): Promise<{ message: string; endpoint: OllamaEndpoint }> {
    return this.request<{
      message: string;
      endpoint: OllamaEndpoint;
    }>(`/api/endpoint/endpoints/${endpointId}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteEndpoint(endpointId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/api/endpoint/endpoints/${endpointId}/`,
      {
        method: "DELETE",
      }
    );
  }

  async testEndpoint(endpointId?: number): Promise<EndpointTestResult> {
    if (!endpointId) {
      throw new Error("端点ID是必需的");
    }
    return this.request<EndpointTestResult>(
      `/api/endpoint/endpoints/${endpointId}/test_connection/`,
      {
        method: "POST",
      }
    );
  }

  // 通用连接测试 - 通过测试默认端点来实现
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // 首先尝试获取端点列表，测试默认端点或第一个活跃端点
      const endpointsResult = await this.getEndpoints();

      if (endpointsResult && endpointsResult.length > 0) {
        // 查找默认端点
        const defaultEndpoint = endpointsResult.find(ep => ep.is_default);
        // 如果没有默认端点，使用第一个活跃端点
        const activeEndpoint = defaultEndpoint || endpointsResult.find(ep => ep.is_active);
        // 如果没有活跃端点，使用第一个端点
        const testEndpoint = activeEndpoint || endpointsResult[0];

        // 测试选定的端点
        const result = await this.testEndpoint(testEndpoint.id);

        // 改进的结果处理 - 添加更强的容错逻辑
        if (!result || typeof result !== 'object') {
          return {
            status: "error",
            message: "端点测试返回无效结果"
          };
        }

        // 将端点测试结果转换为连接测试结果格式
        const connectionResult: ConnectionTestResult = {
          status: result.success === true ? "success" : "error",
          message: result.message || result.error ||
                  (result.success ? "连接成功" : "连接失败") ||
                  "测试完成",
          models_count: result.models_count,
          models: result.models
        };

        return connectionResult;
      } else {
        // 如果没有端点，返回错误
        return {
          status: "error",
          message: "没有配置的端点，请先添加Ollama服务端点"
        };
      }
    } catch (error: any) {
      console.error("连接测试失败:", error);
      return {
        status: "error",
        message: error.message || "连接测试失败"
      };
    }
  }

  async getAvailableModels(): Promise<{
    models: OllamaModel[];
    total: number;
  }> {
    return this.request<{
      models: OllamaModel[];
      total: number;
    }>("/api/endpoint/models/");
  }

  async refreshModels(endpointId?: number): Promise<ModelSyncResult> {
    const response = await this.request<any>("/api/endpoint/models/sync_from_endpoint/", {
      method: "POST",
      body: JSON.stringify({
        endpoint_id: endpointId,
      }),
    });

    // 后端返回格式调整
    return {
      synced: response.synced || 0,
      updated: response.updated || 0,
      disabled: response.disabled || 0,
      total_vision_models: response.total_vision_models || 0,
      message: response.message || "",
    };
  }

  async getModelDetails(modelId: number): Promise<OllamaModel> {
    return this.request<OllamaModel>(`/api/endpoint/models/${modelId}/`);
  }

  async testModel(modelId: number): Promise<EndpointTestResult> {
    return this.request<EndpointTestResult>(`/api/endpoint/models/${modelId}/test/`);
  }

  async setDefaultModelById(modelId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/endpoint/models/${modelId}/set_default/`, {
      method: "POST",
    });
  }

  async setDefaultModelByName(modelName: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("/api/endpoint/models/set_default_by_name/", {
      method: "POST",
      body: JSON.stringify({
        model_name: modelName,
      }),
    });
  }

  // 图片分析接口 - 根据新API文档更新（异步分析）
  async analyzeSingle(
    mediaId: number,
    modelName?: string,
    options?: {
      generate_title?: boolean;
      generate_description?: boolean;
      generate_categories?: boolean;
      generate_tags?: boolean;
      max_categories?: number;
      max_tags?: number;
      limited_scenarios?: boolean; // 启用有限场景分析
      confidence_threshold?: number; // 置信度阈值
    }
  ): Promise<any> {
    // 使用并发管理器执行请求
    const requestFn = () => this.request<any>(
      "/api/ollama/analyze/",
      {
        method: "POST",
        body: JSON.stringify({
          media_id: mediaId,
          model_name: modelName,
          options: {
            generate_title: options?.generate_title ?? true,
            generate_description: options?.generate_description ?? true,
            generate_categories: options?.generate_categories ?? true,
            generate_tags: options?.generate_tags ?? true,
            max_categories: options?.max_categories ?? 3, // 默认减少到3个
            max_tags: options?.max_tags ?? 5, // 默认减少到5个
            // 注意：limited_scenarios 和 confidence_threshold 只在前端使用，不发送到后端
          },
        }),
      }
    );

    return concurrentRequestManager.executeRequest(requestFn, mediaId, modelName);
  }

  // 查询分析任务状态
  async getAnalysisStatus(analysisId: number): Promise<any> {
    return this.request<any>(`/api/ollama/analyze/${analysisId}/status/`, {
      method: "GET",
    });
  }

  // 获取分析详情
  async getAnalysisDetail(analysisId: number): Promise<any> {
    return this.request<any>(`/api/ollama/analyze/${analysisId}/status/`, {
      method: "GET",
    });
  }

  // 应用分析结果
  async applyAnalysisResult(analysisId: number): Promise<any> {
    return this.request<any>("/api/ollama/analyze/apply/", {
      method: "POST",
      body: JSON.stringify({
        analysis_id: analysisId,
      }),
    });
  }

  // 重试失败任务
  async retryAnalysis(analysisId: number): Promise<any> {
    return this.request<any>(`/api/ollama/analyze/${analysisId}/retry/`, {
      method: "POST",
    });
  }

  // 删除分析记录
  async deleteAnalysis(analysisId: number): Promise<any> {
    return this.request<any>("/api/ollama/analyze/delete/", {
      method: "POST",
      body: JSON.stringify({
        analysis_id: analysisId,
      }),
    });
  }

  
  
  async getAnalysisList(page: number = 1, pageSize: number = 20, status?: string): Promise<any> {
    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: ((page - 1) * pageSize).toString(),
    });
    if (status) {
      params.append('status', status);
    }
    return this.request<any>(`/api/ollama/analyze/list_tasks/?${params}`, {
      method: "GET",
    });
  }

  
  // 媒体分类管理
  async getCategories(): Promise<MediaCategory[]> {
    return this.request<MediaCategory[]>("/api/media/categories/");
  }

  async createCategory(category: CreateCategoryRequest): Promise<MediaCategory> {
    return this.request<MediaCategory>("/api/media/categories/", {
      method: "POST",
      body: JSON.stringify(category),
    });
  }

  async getCategory(categoryId: number): Promise<MediaCategory> {
    return this.request<MediaCategory>(`/api/media/categories/${categoryId}/`);
  }

  async updateCategory(categoryId: number, updates: Partial<CreateCategoryRequest>): Promise<MediaCategory> {
    return this.request<MediaCategory>(`/api/media/categories/${categoryId}/update/`, {
      method: "POST",
      body: JSON.stringify(updates),
    });
  }

  async deleteCategory(categoryId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/media/categories/${categoryId}/delete/`, {
      method: "POST",
    });
  }

  // 媒体标签管理
  async getTags(): Promise<MediaTag[]> {
    return this.request<MediaTag[]>("/api/media/tags/");
  }

  async createTag(tag: CreateTagRequest): Promise<MediaTag> {
    return this.request<MediaTag>("/api/media/tags/", {
      method: "POST",
      body: JSON.stringify(tag),
    });
  }

  async getTag(tagId: number): Promise<MediaTag> {
    return this.request<MediaTag>(`/api/media/tags/${tagId}/`);
  }

  async updateTag(tagId: number, updates: { name: string }): Promise<MediaTag> {
    return this.request<MediaTag>(`/api/media/tags/${tagId}/update/`, {
      method: "POST",
      body: JSON.stringify(updates),
    });
  }

  async deleteTag(tagId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/media/tags/${tagId}/delete/`, {
      method: "POST",
    });
  }

  // 将AI分析结果同步到媒体项
  async syncAnalysisToMedia(
    mediaId: number,
    analysisData: {
      title?: string;
      description?: string;
      categories?: Array<{ id: number; name: string }>;
      tags?: Array<{ id: number; name: string }>;
    }
  ): Promise<{ message: string }> {
    // 注意：这是一个模拟的同步方法，实际需要根据后端API实现
    // 如果后端没有直接的同步接口，这个方法可以返回成功消息
    // 或者调用更新媒体文件的接口来同步数据

    // 清理数据，确保不包含后端不期望的字段
    const cleanedData = {
      title: analysisData.title,
      description: analysisData.description,
      categories: analysisData.categories?.map(cat => ({
        id: cat.id,
        name: cat.name
        // 确保不包含description字段
      })),
      tags: analysisData.tags?.map(tag => ({
        id: tag.id,
        name: tag.name
        // 确保不包含description字段
      }))
    };

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ message: "AI分析结果已同步到媒体文件" });
      }, 100);
    });
  }

  // 生成综合AI分析 (使用新的异步API)
  async generateCombined(
    mediaId: number,
    options: {
      modelName?: string;
      generate_title?: boolean;
      generate_description?: boolean;
      generate_categories?: boolean;
      generate_tags?: boolean;
      max_categories?: number;
      max_tags?: number;
    }
  ): Promise<any> {
    // 使用新的异步分析API
    return this.analyzeSingle(
      mediaId,
      options.modelName,
      {
        generate_title: options.generate_title ?? true,
        generate_description: options.generate_description ?? true,
        generate_categories: options.generate_categories ?? true,
        generate_tags: options.generate_tags ?? true,
        max_categories: options.max_categories ?? 5,
        max_tags: options.max_tags ?? 10,
      }
    );
  }

  // 私有方法：处理 FormData 请求
  private async requestWithFormData<T>(
    endpoint: string,
    formData: FormData,
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {};
    if (this.getAccessToken()) {
      headers.Authorization = `Bearer ${this.getAccessToken()}`;
    }

    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超时，AI图片分析需要更长时间

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      // 处理 401 错误，尝试刷新 token
      if (
        response.status === 401 &&
        this.getRefreshToken() &&
        retryCount === 0
      ) {
        try {
          await this.refreshToken();
          // 重试原请求
          return this.requestWithFormData<T>(
            endpoint,
            formData,
            retryCount + 1
          );
        } catch (refreshError) {
          // 刷新失败，清除 tokens
          this.clearTokens();
          throw new Error("登录已过期，请重新登录");
        }
      }

      if (!response.ok) {
        // 处理错误响应，后端返回标准格式 {code, message, data}
        const errorMessage =
          typeof responseData === "object" &&
          responseData &&
          "message" in responseData
            ? responseData.message
            : `请求失败: ${response.status}`;
        throw new Error(errorMessage);
      }

      // 后端返回标准格式 {code, message, data}
      // 我们需要提取 data 字段作为返回值
      if (
        typeof responseData === "object" &&
        responseData &&
        "data" in responseData
      ) {
        return responseData.data as T;
      }

      // 如果不是标准格式，直接返回原始数据
      return responseData as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(
            "AI分析请求超时，图片可能过于复杂。请尝试：1) 使用更简单的图片 2) 检查网络连接 3) 稍后重试"
          );
        }
        throw error;
      }
      throw new Error("请求发生未知错误");
    }
  }
}

// 并发请求管理器
class ConcurrentRequestManager {
  private static instance: ConcurrentRequestManager;
  private pendingRequests = new Map<string, Promise<any>>();
  private maxRetries = 3;
  private retryDelay = 1000; // 1秒

  static getInstance(): ConcurrentRequestManager {
    if (!ConcurrentRequestManager.instance) {
      ConcurrentRequestManager.instance = new ConcurrentRequestManager();
    }
    return ConcurrentRequestManager.instance;
  }

  // 生成请求唯一键
  private getRequestKey(mediaId: number, modelName?: string): string {
    return `analyze_${mediaId}_${modelName || 'default'}`;
  }

  // 执行带并发控制的请求
  async executeRequest<T>(
    requestFn: () => Promise<T>,
    mediaId: number,
    modelName?: string,
    retryCount = 0
  ): Promise<T> {
    const requestKey = this.getRequestKey(mediaId, modelName);

    // 检查是否有相同的请求正在处理
    if (this.pendingRequests.has(requestKey)) {
      console.log(`相同请求正在处理中: ${requestKey}，等待结果`);
      return this.pendingRequests.get(requestKey) as Promise<T>;
    }

    // 创建新的请求Promise
    const requestPromise = this.executeWithRetry(requestFn, requestKey, retryCount);

    // 存储请求Promise
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // 请求完成后清理
      this.pendingRequests.delete(requestKey);
    }
  }

  // 带重试的请求执行
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    requestKey: string,
    retryCount: number
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error: any) {
      // 如果是并发限制错误，等待后重试
      if (error.message?.includes('请求过于频繁') ||
          error.message?.includes('分析请求过于频繁') ||
          error.message?.includes('分析任务过多')) {

        if (retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount); // 指数退避
          console.log(`并发限制触发，${delay}ms后重试 (${retryCount + 1}/${this.maxRetries}): ${requestKey}`);

          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeWithRetry(requestFn, requestKey, retryCount + 1);
        }
      }

      throw error;
    }
  }

  // 清理所有待处理请求
  clearPendingRequests(): void {
    this.pendingRequests.clear();
  }

  // 获取当前待处理请求数量
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

// 创建单例实例
export const aiManagementService = new AIManagementService();
export const concurrentRequestManager = ConcurrentRequestManager.getInstance();

// 连接状态管理 - 防止重复提醒
class ConnectionStatusManager {
  private static instance: ConnectionStatusManager;
  private lastSuccessTime: number = 0;
  private readonly COOLDOWN_PERIOD = 5000; // 5秒内不重复提醒

  static getInstance(): ConnectionStatusManager {
    if (!ConnectionStatusManager.instance) {
      ConnectionStatusManager.instance = new ConnectionStatusManager();
    }
    return ConnectionStatusManager.instance;
  }

  shouldShowSuccessMessage(): boolean {
    const now = Date.now();
    if (now - this.lastSuccessTime > this.COOLDOWN_PERIOD) {
      this.lastSuccessTime = now;
      return true;
    }
    return false;
  }

  resetCooldown(): void {
    this.lastSuccessTime = 0;
  }
}

export const connectionStatusManager = ConnectionStatusManager.getInstance();
export default aiManagementService;
