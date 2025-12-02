// API 客户端配置和类型定义
import { convertMediaUrls, convertMediaListUrls } from "./media-utils";

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface User {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
}

export interface UserProfile extends User {
  phone?: string;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  user: User;
  refresh: string;
  access: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  phone: string; // 根据后端接口文档，手机号是必需的
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  username?: string;
  phone?: string;
  avatar?: string;
}

// Media Management Types
export interface MediaCategory {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MediaTag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface MediaFile {
  id: number;
  title: string;
  description: string;
  prompt: string;
  file: string;
  file_type: string;
  file_size: number;
  thumbnail: string | null;
  file_url: string;
  thumbnail_url: string | null;
  user: number;
  categories: MediaCategory[];
  tags: MediaTag[];
  created_at: string;
  updated_at: string;
}

export interface MediaListItem {
  id: number;
  title: string;
  description: string | null;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url: string | null;
  created_at: string;
  ai_description: string | null;
  ai_tags?: Array<{
    id: number;
    name: string;
  }> | null;
  ai_categories?: Array<{
    id: number;
    name: string;
  }> | null;
  ai_prompt?: string | null;
  ai_analyzed_at?: string | null;
  // 添加完整的分类和标签字段
  categories?: Array<{
    id: number;
    name: string;
  }> | null;
  tags?: Array<{
    id: number;
    name: string;
  }> | null;
}

export interface PaginatedMediaList {
  results: MediaListItem[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedCategoryList {
  results: MediaCategory[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedTagList {
  results: MediaTag[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateCategoryData {
  name: string;
  description: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
}

export interface CreateTagData {
  name: string;
}

export interface UpdateTagData {
  name: string;
}

export interface UploadMediaData {
  file: File;
  title: string;
  description?: string;
  prompt?: string;
  category_ids?: number[];
  tag_ids?: number[];
}

export interface UpdateMediaData {
  title?: string;
  description?: string;
  prompt?: string;
  category_ids?: number[];
  tag_ids?: number[];
}

export interface AddCategoriesData {
  category_ids: number[];
}

export interface RemoveCategoriesData {
  category_ids: number[];
}

export interface AddTagsData {
  tag_ids: number[];
}

export interface RemoveTagsData {
  tag_ids: number[];
}

// 批量操作接口
export interface BatchDeleteData {
  ids: number[];
}

// Ollama AI 相关类型定义
export interface OllamaModel {
  id: number;
  name: string;
  display_name: string;
  description: string;
  is_active: boolean;
  is_vision_capable: boolean;
  model_size: string;
  api_endpoint?: string;
}

export interface AIAnalysisResult {
  id: number;
  media: {
    id: number;
    title: string;
    file_type: string;
    file_url?: string;
  };
  status: string;
  model_used: string;
  suggestions: {
    title?: string;
    description?: string;
    prompt?: string;
    categories?: SuggestedCategory[];
    tags?: SuggestedTag[];
  };
  analysis_result: any;
  suggested_categories: SuggestedCategory[];
  suggested_tags: SuggestedTag[];
  error_message?: string;
  created_at: string;
  updated_at: string;
  analyzed_at?: string;
}

export interface SuggestedCategory {
  id?: number;
  name: string;
  confidence: number;
}

export interface SuggestedTag {
  id?: number;
  name: string;
  confidence: number;
}

export interface CombinedAnalysisOptions {
  generateTitle?: boolean;
  generateDescription?: boolean;
  generatePrompt?: boolean;
  generateCategories?: boolean;
  generateTags?: boolean;
  maxCategories?: number;
  maxTags?: number;
  modelName?: string;
}

export interface ApplyAnalysisOptions {
  applyTitle?: boolean;
  applyDescription?: boolean;
  applyPrompt?: boolean;
  applyCategories?: boolean;
  applyTags?: boolean;
  categoryIds?: number[];
  tagIds?: number[];
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
  can_delete?: boolean;
  is_owner?: boolean;
}

export interface BatchUpdateCategoriesData {
  ids: number[];
  category_ids: number[];
}

export interface BatchAddTagsData {
  ids: number[];
  tag_ids: number[];
}

export interface BatchRemoveTagsData {
  ids: number[];
  tag_ids: number[];
}

// API 基础配置
// 在开发环境中使用相对路径，通过 Next.js 代理访问后端
// 在生产环境中可以使用环境变量配置完整的后端URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

class ApiClient {
  private baseURL: string;
  private onUnauthorized?: () => void;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  // 设置全局401错误处理回调
  setUnauthorizedHandler(handler: () => void) {
    this.onUnauthorized = handler;
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
  clearTokens() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
  }

  // 通用请求方法
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    return this.requestWithTimeout<T>(endpoint, options, 10000, retryCount); // 默认10秒超时
  }

  // 带自定义超时的请求方法
  private async requestWithTimeout<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs = 10000,
    retryCount = 0
  ): Promise<ApiResponse<T>> {
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
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: ApiResponse<T> = await response.json();

      // 处理 401 错误，尝试刷新 token
      if (
        response.status === 401 &&
        this.getRefreshToken() &&
        retryCount === 0
      ) {
        try {
          await this.refreshToken();
          // 重试原请求
          return this.requestWithTimeout<T>(
            endpoint,
            options,
            timeoutMs,
            retryCount + 1
          );
        } catch (refreshError) {
          // 刷新失败，清除 tokens
          this.clearTokens();
          this.clearUser();
          // 调用全局401错误处理回调
          if (this.onUnauthorized) {
            this.onUnauthorized();
          }
          throw new Error("登录已过期，请重新登录");
        }
      }

      if (!response.ok) {
        throw new Error(data.message || `请求失败: ${response.status}`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`请求超时，请检查网络连接 (${timeoutMs / 1000}秒)`);
        }
        throw error;
      }
      throw new Error("请求发生未知错误");
    }
  }

  // 用户注册
  async register(data: RegisterData): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify(data),
    });

    // 保存 tokens
    if (response.data.access && response.data.refresh) {
      this.saveTokens(response.data.access, response.data.refresh);
    }

    return response;
  }

  // 用户登录
  async login(data: LoginData): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify(data),
    });

    // 保存 tokens
    if (response.data.access && response.data.refresh) {
      this.saveTokens(response.data.access, response.data.refresh);
    }

    return response;
  }

  // 用户登出
  async logout(): Promise<ApiResponse<null>> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      throw new Error("没有有效的 refresh token");
    }

    const response = await this.request<null>("/api/auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh: refreshToken }),
    });

    // 清除 tokens
    this.clearTokens();

    return response;
  }

  // 刷新 token
  async refreshToken(): Promise<ApiResponse<AuthTokens>> {
    const currentRefreshToken = this.getRefreshToken();

    if (!currentRefreshToken) {
      throw new Error("没有有效的 refresh token");
    }

    const response = await this.request<AuthTokens>("/api/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: currentRefreshToken }),
    });

    // 更新 tokens
    if (response.data.access && response.data.refresh) {
      this.saveTokens(response.data.access, response.data.refresh);
    }

    return response;
  }

  // 获取当前用户基本信息
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>("/api/users/me/");
  }

  // 获取当前用户详细资料
  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>("/api/users/profile/");
  }

  // 更新用户资料
  async updateProfile(
    data: UpdateProfileData
  ): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>("/api/users/update_profile/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 检查是否已登录
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // 获取当前保存的用户信息（如果有）
  getSavedUser(): User | null {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  }

  // 保存用户信息
  saveUser(user: User) {
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user));
    }
  }

  // 清除用户信息
  clearUser() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
    }
  }

  // ============ 媒体分类管理 ============

  // 创建分类
  async createCategory(
    data: CreateCategoryData
  ): Promise<ApiResponse<MediaCategory>> {
    return this.request<MediaCategory>("/api/media/categories/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 获取分类列表
  async getCategories(
    page: number = 1,
    pageSize: number = 10,
    search?: string
  ): Promise<ApiResponse<PaginatedCategoryList>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    return this.request<PaginatedCategoryList>(`/api/media/categories/?${params.toString()}`);
  }

  // 获取特定分类详情
  async getCategory(id: number): Promise<ApiResponse<MediaCategory>> {
    return this.request<MediaCategory>(`/api/media/categories/${id}/`);
  }

  // 更新分类
  async updateCategory(
    id: number,
    data: UpdateCategoryData
  ): Promise<ApiResponse<MediaCategory>> {
    return this.request<MediaCategory>(`/api/media/categories/${id}/update/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 删除分类
  async deleteCategory(id: number): Promise<ApiResponse<null>> {
    return this.request<null>(`/api/media/categories/${id}/delete/`, {
      method: "POST",
    });
  }

  // ============ 媒体标签管理 ============

  // 创建标签
  async createTag(data: CreateTagData): Promise<ApiResponse<MediaTag>> {
    return this.request<MediaTag>("/api/media/tags/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 获取标签列表
  async getTags(
    page: number = 1,
    pageSize: number = 10,
    search?: string
  ): Promise<ApiResponse<PaginatedTagList>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    return this.request<PaginatedTagList>(`/api/media/tags/?${params.toString()}`);
  }

  // 获取特定标签详情
  async getTag(id: number): Promise<ApiResponse<MediaTag>> {
    return this.request<MediaTag>(`/api/media/tags/${id}/`);
  }

  // 更新标签
  async updateTag(
    id: number,
    data: UpdateTagData
  ): Promise<ApiResponse<MediaTag>> {
    return this.request<MediaTag>(`/api/media/tags/${id}/update/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 删除标签
  async deleteTag(id: number): Promise<ApiResponse<null>> {
    return this.request<null>(`/api/media/tags/${id}/delete/`, {
      method: "POST",
    });
  }

  // ============ 媒体文件管理 ============

  // 上传媒体文件
  async uploadMedia(data: UploadMediaData): Promise<ApiResponse<MediaFile>> {
    const formData = new FormData();

    // 确保file是File对象
    if (data.file instanceof File) {
      formData.append("file", data.file);
    } else {
      throw new Error("Invalid file object");
    }

    formData.append("title", data.title);

    if (data.description) formData.append("description", data.description);
    if (data.prompt) formData.append("prompt", data.prompt);
    if (data.category_ids && data.category_ids.length > 0) {
      // 将数组作为 JSON 字符串发送
      formData.append("category_ids", JSON.stringify(data.category_ids));
    }
    if (data.tag_ids && data.tag_ids.length > 0) {
      // 将数组作为 JSON 字符串发送
      formData.append("tag_ids", JSON.stringify(data.tag_ids));
    }

    // 对于 FormData，我们需要特殊处理，不设置 Content-Type
    // 让浏览器自动设置 multipart/form-data 边界
    const url = `${this.baseURL}/api/media/upload/`;

    // 获取当前的 access token
    const token = this.getAccessToken();

    const headers: Record<string, string> = {};

    // 如果需要认证，添加 Authorization header
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时，文件上传需要更长时间

    try {
      // 调试信息：打印 FormData 内容
      console.log("Uploading to:", url);
      console.log("Request headers:", headers);
      console.log("FormData contents:");
      for (let [key, value] of formData.entries()) {
        console.log(key, value, typeof value);
      }

      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 检查响应状态
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      let responseData: ApiResponse<MediaFile>;
      try {
        responseData = await response.json();
        console.log("Response data:", responseData);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        const responseText = await response.text();
        console.error("Response text:", responseText);
        throw new Error(`服务器响应格式错误: ${response.status}`);
      }

      // 处理 401 错误，尝试刷新 token
      if (response.status === 401 && this.getRefreshToken()) {
        try {
          await this.refreshToken();
          // 重试原请求
          const newToken = this.getAccessToken();
          const retryHeaders: Record<string, string> = {};
          if (newToken) {
            retryHeaders.Authorization = `Bearer ${newToken}`;
          }

          const retryResponse = await fetch(url, {
            method: "POST",
            body: formData,
            headers: retryHeaders,
            signal: controller.signal,
          });

          const retryData: ApiResponse<MediaFile> = await retryResponse.json();

          if (!retryResponse.ok) {
            throw new Error(
              retryData.message || `请求失败: ${retryResponse.status}`
            );
          }

          // 转换媒体文件URL
          retryData.data = convertMediaUrls(retryData.data);
          return retryData;
        } catch (refreshError) {
          // 刷新失败，清除 tokens
          this.clearTokens();
          this.clearUser();
          // 调用全局401错误处理回调
          if (this.onUnauthorized) {
            this.onUnauthorized();
          }
          throw new Error("登录已过期，请重新登录");
        }
      }

      if (!response.ok) {
        throw new Error(responseData.message || `请求失败: ${response.status}`);
      }

      // 转换媒体文件URL
      responseData.data = convertMediaUrls(responseData.data);
      return responseData;
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

  // 获取媒体文件列表
  async getMediaList(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    categoryId?: number,
    tagId?: number,
    fileType?: string
  ): Promise<ApiResponse<PaginatedMediaList>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (search) {
      params.append("search", search);
    }
    if (categoryId) {
      params.append("category", categoryId.toString());
    }
    if (tagId) {
      params.append("tag", tagId.toString());
    }
    if (fileType) {
      params.append("file_type", fileType);
    }

    const response = await this.request<PaginatedMediaList>(
      `/api/media/?${params}`
    );

    // 转换媒体文件列表URL
    if (response.data && response.data.results) {
      response.data.results = convertMediaListUrls(response.data.results);
    }

    return response;
  }

  // 获取特定媒体文件详情
  async getMedia(id: number): Promise<ApiResponse<MediaFile>> {
    const response = await this.request<MediaFile>(`/api/media/${id}/`);

    // 转换媒体文件URL
    if (response.data) {
      response.data = convertMediaUrls(response.data);
    }

    return response;
  }

  // 更新媒体文件信息
  async updateMedia(
    id: number,
    data: UpdateMediaData
  ): Promise<ApiResponse<MediaFile>> {
    const response = await this.request<MediaFile>(`/api/media/${id}/update/`, {
      method: "POST",
      body: JSON.stringify(data),
    });

    // 转换媒体文件URL
    if (response.data) {
      response.data = convertMediaUrls(response.data);
    }

    return response;
  }

  // 删除媒体文件
  async deleteMedia(id: number): Promise<ApiResponse<null>> {
    return this.request<null>(`/api/media/${id}/delete/`, {
      method: "POST",
    });
  }

  // 为媒体文件添加分类
  async addCategoriesToMedia(
    id: number,
    data: AddCategoriesData
  ): Promise<ApiResponse<null>> {
    return this.request<null>(`/api/media/${id}/add_categories/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 从媒体文件移除分类
  async removeCategoriesFromMedia(
    id: number,
    data: RemoveCategoriesData
  ): Promise<ApiResponse<null>> {
    return this.request<null>(`/api/media/${id}/remove_categories/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 为媒体文件添加标签
  async addTagsToMedia(
    id: number,
    data: AddTagsData
  ): Promise<ApiResponse<null>> {
    return this.request<null>(`/api/media/${id}/add_tags/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 从媒体文件移除标签
  async removeTagsFromMedia(
    id: number,
    data: RemoveTagsData
  ): Promise<ApiResponse<null>> {
    return this.request<null>(`/api/media/${id}/remove_tags/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ============ 批量操作 ============

  // 批量删除媒体文件
  async batchDeleteMedia(data: BatchDeleteData): Promise<ApiResponse<null>> {
    return this.request<null>("/api/media/batch-delete/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 批量更新分类
  async batchUpdateCategories(
    data: BatchUpdateCategoriesData
  ): Promise<ApiResponse<null>> {
    return this.request<null>("/api/media/batch-update-categories/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 批量添加标签
  async batchAddTags(data: BatchAddTagsData): Promise<ApiResponse<null>> {
    return this.request<null>("/api/media/batch-add-tags/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 批量移除标签
  async batchRemoveTags(data: BatchRemoveTagsData): Promise<ApiResponse<null>> {
    return this.request<null>("/api/media/batch-remove-tags/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ============ Ollama AI 分析接口 ============

  // 生成综合AI分析
  async generateCombined(
    mediaId: number,
    options: CombinedAnalysisOptions
  ): Promise<ApiResponse<any>> {
    return this.request<any>("/api/ollama/analyze/", {
      method: "POST",
      body: JSON.stringify({
        media_id: mediaId,
        model_name: options.modelName,
        force_reanalyze: true, // 强制重新分析以获取最新结果
        options: {
          generate_title: options.generateTitle ?? true,
          generate_description: options.generateDescription ?? true,
          generate_prompt: options.generatePrompt ?? true,
          generate_categories: options.generateCategories ?? true,
          generate_tags: options.generateTags ?? true,
          max_categories: options.maxCategories ?? 5,
          max_tags: options.maxTags ?? 10,
        },
      }),
    });
  }

  // 获取可用模型列表
  async getAvailableModels(): Promise<ApiResponse<any>> {
    return this.request<any>("/api/ollama/models/");
  }

  // 刷新 Ollama 模型
  async refreshOllamaModels(endpointId?: number): Promise<ApiResponse<any>> {
    return this.request<any>("/api/ollama/models/refresh_all/", {
      method: "POST",
      body: JSON.stringify({
        endpoint_id: endpointId,
      }),
    });
  }

  // 获取模型详情
  async getModelDetails(modelId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/ollama/models/${modelId}/`);
  }

  // 测试模型连接
  async testModel(modelId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/ollama/models/${modelId}/test/`);
  }

  // 设置默认模型（通过ID）
  async setDefaultModelById(modelId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/ollama/models/${modelId}/default/`, {
      method: "POST",
    });
  }

  // 设置默认模型（通过名称和端点）
  async setDefaultModelByName(
    modelName: string,
    endpointId: number
  ): Promise<ApiResponse<any>> {
    return this.request<any>("/api/ollama/models/set-default/", {
      method: "POST",
      body: JSON.stringify({
        model_name: modelName,
        endpoint_id: endpointId,
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
      generate_prompt?: boolean;
      generate_categories?: boolean;
      generate_tags?: boolean;
      max_categories?: number;
      max_tags?: number;
      limited_scenarios?: boolean; // 启用有限场景分析
      confidence_threshold?: number; // 置信度阈值
    }
  ): Promise<ApiResponse<any>> {
    // AI分析使用较短的30秒超时，因为这是创建任务请求
    return this.requestWithTimeout<any>(
      "/api/ollama/analyze/",
      {
        method: "POST",
        body: JSON.stringify({
          media_id: mediaId,
          model_name: modelName,
          options: {
            generate_title: options?.generate_title ?? true,
            generate_description: options?.generate_description ?? true,
            generate_prompt: options?.generate_prompt ?? false, // 默认不生成prompt以提高速度
            generate_categories: options?.generate_categories ?? true,
            generate_tags: options?.generate_tags ?? true,
            max_categories: options?.max_categories ?? 3, // 默认减少到3个
            max_tags: options?.max_tags ?? 5, // 默认减少到5个
            // 注意：limited_scenarios 和 confidence_threshold 只在前端使用，不发送到后端
          },
        }),
      },
      30000 // 30秒超时，只是创建任务
    );
  }

  // 获取AI分析状态
  async getAIAnalysisStatus(analysisId: number): Promise<ApiResponse<any>> {
    console.log(`🚀 [API] 获取分析状态: analysisId=${analysisId}`);

    try {
      const response = await this.request<any>(`/api/ollama/analyze/${analysisId}/status/`, {
        method: "GET",
      });

      console.log(`🚀 [API] 分析状态响应:`, response);
      return response;
    } catch (error) {
      console.error(`🚀 [API] 获取分析状态失败:`, error);
      throw error;
    }
  }

  // 获取AI分析列表
  async getAnalysisList(
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse<any>> {
    // 计算offset，后端使用offset而不是page
    const offset = (page - 1) * pageSize;

    // 使用query parameters而不是body
    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: offset.toString(),
    });

    return this.request<any>(`/api/ollama/analyze/list_tasks/?${params}`, {
      method: "GET",
    });
  }

  // 获取分析结果详情
  async getAnalysisDetails(analysisId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/ollama/analyze/${analysisId}/status/`, {
      method: "GET",
    });
  }

  // ============ Ollama 端点管理接口 ============

  // 获取所有端点
  async getEndpoints(): Promise<ApiResponse<any>> {
    return this.request<any>("/api/ollama/endpoints/");
  }

  // 创建新端点
  async createEndpoint(data: {
    name: string;
    url: string;
    description?: string;
    is_default?: boolean;
    timeout?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<any>("/api/ollama/endpoints/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 获取端点详情
  async getEndpoint(endpointId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/ollama/endpoints/${endpointId}/`);
  }

  // 更新端点
  async updateEndpoint(
    endpointId: number,
    data: {
      name?: string;
      url?: string;
      description?: string;
      is_active?: boolean;
      is_default?: boolean;
      timeout?: number;
    }
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/ollama/endpoints/${endpointId}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // 删除端点
  async deleteEndpoint(endpointId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/api/ollama/endpoints/${endpointId}/delete/`, {
      method: "POST",
    });
  }

  // 测试端点连接
  async testEndpoint(endpointId?: number): Promise<ApiResponse<any>> {
    if (!endpointId) {
      throw new Error("端点ID是必需的");
    }
    return this.request<any>(`/api/ollama/endpoints/${endpointId}/test_connection/`, {
      method: "POST",
    });
  }
}

// 创建 API 客户端实例
export const apiClient = new ApiClient(API_BASE_URL);

// 导出默认实例
export default apiClient;
