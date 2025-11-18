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
  model_size: string;
  api_endpoint: string;
}

export interface OllamaEndpoint {
  id: number;
  name: string;
  url: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
  timeout: number;
  created_by: string;
  created_at: string;
  updated_at: string;
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
}

export interface ConnectionTestResult {
  status: "success" | "error";
  message: string;
  available_models?: number;
  models?: string[];
}

export interface ModelSyncResult {
  synced: number;
  updated: number;
  message?: string;
}

export interface BatchAnalysisJob {
  job_id: string;
  status: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  progress_percentage: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: T = await response.json();

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
        // 处理错误响应，可能是字符串或对象
        const errorMessage =
          typeof data === "object" && data && "message" in data
            ? (data as any).message
            : `请求失败: ${response.status}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("请求超时，请检查网络连接");
        }
        throw error;
      }
      throw new Error("请求发生未知错误");
    }
  }

  // 端点管理
  async getEndpoints(): Promise<{
    endpoints: OllamaEndpoint[];
    total: number;
  }> {
    return this.request<{
      endpoints: OllamaEndpoint[];
      total: number;
    }>("/api/ollama/endpoints/");
  }

  async createEndpoint(
    data: CreateEndpointRequest
  ): Promise<{ message: string; endpoint: OllamaEndpoint }> {
    return this.request<{
      message: string;
      endpoint: OllamaEndpoint;
    }>("/api/ollama/endpoints/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getEndpoint(endpointId: number): Promise<OllamaEndpoint> {
    return this.request<OllamaEndpoint>(`/api/ollama/endpoints/${endpointId}/`);
  }

  async updateEndpoint(
    endpointId: number,
    data: UpdateEndpointRequest
  ): Promise<{ message: string; endpoint: OllamaEndpoint }> {
    return this.request<{
      message: string;
      endpoint: OllamaEndpoint;
    }>(`/api/ollama/endpoints/${endpointId}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteEndpoint(endpointId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/api/ollama/endpoints/${endpointId}/`,
      {
        method: "DELETE",
      }
    );
  }

  async testEndpoint(endpointId?: number): Promise<EndpointTestResult> {
    const url = endpointId
      ? `/api/ollama/endpoints/${endpointId}/test/`
      : "/api/ollama/endpoints/test/";
    return this.request<EndpointTestResult>(url, {
      method: "POST",
    });
  }

  // 模型管理
  async testConnection(): Promise<ConnectionTestResult> {
    return this.request<ConnectionTestResult>("/api/ollama/test-connection/");
  }

  async getAvailableModels(): Promise<{
    models: OllamaModel[];
    total: number;
  }> {
    return this.request<{
      models: OllamaModel[];
      total: number;
    }>("/api/ollama/models/");
  }

  async syncModels(): Promise<ModelSyncResult> {
    return this.request<ModelSyncResult>("/api/ollama/models/sync/", {
      method: "POST",
    });
  }

  
  async applyAnalysisSuggestions(
    mediaId: number,
    options: {
      applyTitle?: boolean;
      applyDescription?: boolean;
      applyPrompt?: boolean;
      applyCategories?: boolean;
      applyTags?: boolean;
      categoryIds?: number[];
      tagIds?: number[];
    }
  ): Promise<any> {
    return this.request<any>(`/api/ollama/analysis/${mediaId}/apply/`, {
      method: "POST",
      body: JSON.stringify({
        apply_title: options.applyTitle,
        apply_description: options.applyDescription,
        apply_prompt: options.applyPrompt,
        apply_categories: options.applyCategories,
        apply_tags: options.applyTags,
        category_ids: options.categoryIds || [],
        tag_ids: options.tagIds || [],
      }),
    });
  }

  async generateTitle(mediaId: number, modelName?: string): Promise<any> {
    const formData = new FormData();
    formData.append("media_id", mediaId.toString());
    if (modelName) {
      formData.append("model_name", modelName);
    }

    return this.requestWithFormData<any>(
      "/api/ollama/generate/title/",
      formData
    );
  }

  async generateDescription(mediaId: number, modelName?: string): Promise<any> {
    const formData = new FormData();
    formData.append("media_id", mediaId.toString());
    if (modelName) {
      formData.append("model_name", modelName);
    }

    return this.requestWithFormData<any>(
      "/api/ollama/generate/description/",
      formData
    );
  }

  async generatePrompt(mediaId: number, modelName?: string): Promise<any> {
    const formData = new FormData();
    formData.append("media_id", mediaId.toString());
    if (modelName) {
      formData.append("model_name", modelName);
    }

    return this.requestWithFormData<any>(
      "/api/ollama/generate/prompt/",
      formData
    );
  }

  async generateCategories(
    mediaId: number,
    maxCategories: number = 5,
    modelName?: string
  ): Promise<any> {
    const formData = new FormData();
    formData.append("media_id", mediaId.toString());
    formData.append("max_categories", maxCategories.toString());
    if (modelName) {
      formData.append("model_name", modelName);
    }

    return this.requestWithFormData<any>(
      "/api/ollama/generate/categories/",
      formData
    );
  }

  async generateTags(
    mediaId: number,
    maxTags: number = 10,
    modelName?: string
  ): Promise<any> {
    const formData = new FormData();
    formData.append("media_id", mediaId.toString());
    formData.append("max_tags", maxTags.toString());
    if (modelName) {
      formData.append("model_name", modelName);
    }

    return this.requestWithFormData<any>(
      "/api/ollama/generate/tags/",
      formData
    );
  }

  async generateCombined(
    mediaId: number,
    options: {
      generateTitle?: boolean;
      generateDescription?: boolean;
      generatePrompt?: boolean;
      generateCategories?: boolean;
      generateTags?: boolean;
      maxCategories?: number;
      maxTags?: number;
      modelName?: string;
    }
  ): Promise<any> {
    const formData = new FormData();
    formData.append("media_id", mediaId.toString());

    if (options.generateTitle !== undefined) {
      formData.append("generate_title", options.generateTitle.toString());
    }
    if (options.generateDescription !== undefined) {
      formData.append(
        "generate_description",
        options.generateDescription.toString()
      );
    }
    if (options.generatePrompt !== undefined) {
      formData.append("generate_prompt", options.generatePrompt.toString());
    }
    if (options.generateCategories !== undefined) {
      formData.append(
        "generate_categories",
        options.generateCategories.toString()
      );
    }
    if (options.generateTags !== undefined) {
      formData.append("generate_tags", options.generateTags.toString());
    }
    if (options.maxCategories !== undefined) {
      formData.append("max_categories", options.maxCategories.toString());
    }
    if (options.maxTags !== undefined) {
      formData.append("max_tags", options.maxTags.toString());
    }
    if (options.modelName) {
      formData.append("model_name", options.modelName);
    }

    return this.requestWithFormData<any>(
      "/api/ollama/generate/combined/",
      formData
    );
  }

  // 批量分析功能
  async batchAnalyze(
    mediaIds: number[],
    modelName?: string
  ): Promise<{ job_id: string }> {
    return this.request<{ job_id: string }>("/api/ollama/batch-analyze/", {
      method: "POST",
      body: JSON.stringify({
        media_ids: mediaIds,
        model_name: modelName,
      }),
    });
  }

  async getBatchAnalysisStatus(jobId: string): Promise<BatchAnalysisJob> {
    return this.request<BatchAnalysisJob>(
      `/api/ollama/batch-analyze/${jobId}/status/`
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
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时，FormData可能需要更长时间

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: T = await response.json();

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
        // 处理错误响应，可能是字符串或对象
        const errorMessage =
          typeof data === "object" && data && "message" in data
            ? (data as any).message
            : `请求失败: ${response.status}`;
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("请求超时，请检查网络连接");
        }
        throw error;
      }
      throw new Error("请求发生未知错误");
    }
  }
}

// 创建单例实例
export const aiManagementService = new AIManagementService();

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
