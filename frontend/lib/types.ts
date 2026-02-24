/**
 * @fileoverview 类型定义文件
 * 包含所有前端使用的 TypeScript 接口和类型定义
 * @module lib/types
 */

/**
 * 后端统一响应格式
 * @template T - 响应数据类型
 */
export interface APIResponse<T = any> {
  /** HTTP 状态码 */
  code: number;
  /** 响应消息 */
  message: string;
  /** 响应数据 */
  data: T | null;
  /** 详细错误信息 */
  detail?: any;
}

/**
 * 用户模型
 */
export interface User {
  /** 用户 ID */
  id: number;
  /** 邮箱地址 */
  email: string;
  /** 用户名 */
  username: string;
  /** 手机号 */
  phone?: string;
  /** 头像路径 */
  avatar?: string;
  /** 头像完整 URL */
  avatar_url?: string | null;
  /** 注册时间 */
  date_joined: string;
  /** 最后登录时间 */
  last_login?: string;
}

/**
 * JWT Token 对
 */
export interface TokenPair {
  /** 访问令牌 */
  access: string;
  /** 刷新令牌 */
  refresh: string;
}

/**
 * 登录响应（包含用户信息）
 */
export interface LoginResponse {
  /** 访问令牌 */
  access: string;
  /** 刷新令牌 */
  refresh: string;
  /** 用户信息 */
  user: User;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  /** 邮箱地址 */
  email: string;
  /** 密码 */
  password: string;
}

/**
 * 注册请求
 */
export interface RegisterRequest {
  /** 邮箱地址 */
  email: string;
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 确认密码 */
  password_confirm: string;
  /** 手机号 */
  phone?: string;
}

/**
 * 获取 Token 请求 (simplejwt 默认)
 */
export interface TokenRequest {
  /** 用户名（simplejwt 默认用 username，但登录用 email） */
  username?: string;
  /** 密码 */
  password: string;
}

/**
 * 刷新 Token 请求
 */
export interface RefreshTokenRequest {
  /** 刷新令牌 */
  refresh: string;
}

/**
 * 修改密码请求
 */
export interface UpdatePasswordRequest {
  /** 旧密码 */
  old_password: string;
  /** 新密码 */
  new_password: string;
  /** 确认新密码 */
  new_password_confirm: string;
}

/**
 * 更新用户信息请求
 */
export interface UpdateProfileRequest {
  /** 用户名 */
  username?: string;
  /** 手机号 */
  phone?: string;
  /** 头像 */
  avatar?: string;
}

// ============ 媒体相关类型 ============

/**
 * 后端分页信息（新版格式）
 */
export interface BackendPagination {
  /** 总记录数 */
  count: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  page_size: number;
  /** 总页数 */
  total_pages: number;
  /** 是否有下一页 */
  has_next: boolean;
  /** 是否有上一页 */
  has_previous: boolean;
}

/**
 * 后端统一分页响应格式
 * @template T - 数据项类型
 */
export interface BackendPaginatedResponse<T> {
  /** 状态码 */
  code: number;
  /** 响应消息 */
  message: string;
  /** 数据数组 */
  data: T[];
  /** 分页信息 */
  pagination: BackendPagination;
}

/**
 * 旧版分页响应类型（兼容）
 * @template T - 数据项类型
 */
export interface PaginatedResponse<T> {
  /** 总记录数 */
  count: number;
  /** 下一页 URL */
  next: string | null;
  /** 上一页 URL */
  previous: string | null;
  /** 数据数组 */
  results: T[];
}

/**
 * 统一分页响应类型（兼容两种格式）
 * @template T - 数据项类型
 */
export type UnifiedPaginatedResponse<T> =
  | BackendPaginatedResponse<T>
  | { code: number; message: string; data: T[] | PaginatedResponse<T> };

/**
 * 从响应中提取数据数组
 * 兼容新版格式 { code, message, data: [...], pagination: {...} }
 * 和旧版格式 { code, message, data: { count, results: [...] } }
 *
 * @template T - 数据项类型
 * @param response - API 响应
 * @returns 数据数组，如果无法提取则返回空数组
 *
 * @example
 * ```typescript
 * const response = await mediaApi.getImages();
 * const mediaList = extractPaginatedData<Media>(response);
 * ```
 */
export function extractPaginatedData<T>(response: any): T[] {
  if (!response || !response.data) {
    return [];
  }
  // 后端新版格式：{ code, message, data: [...], pagination: {...} }
  if (Array.isArray(response.data)) {
    return response.data as T[];
  }
  // 旧版格式：{ code, message, data: { count, results: [...] } }
  if (response.data.results && Array.isArray(response.data.results)) {
    return response.data.results as T[];
  }
  return [];
}

/**
 * 从响应中提取分页信息
 *
 * @param response - API 响应
 * @returns 分页信息，如果无法提取则返回 null
 *
 * @example
 * ```typescript
 * const response = await mediaApi.getImages({ page: 1, page_size: 20 });
 * const pagination = extractPaginationInfo(response);
 * console.log(pagination?.has_next); // 是否有下一页
 * ```
 */
export function extractPaginationInfo(response: any): BackendPagination | null {
  if (!response) return null;

  // 后端新版格式
  if (response.pagination) {
    return response.pagination;
  }
  // 旧版格式转换
  if (response.data && 'count' in response.data) {
    return {
      count: response.data.count,
      page: 1,
      page_size: response.data.results?.length || 20,
      total_pages: Math.ceil(response.data.count / (response.data.results?.length || 20)),
      has_next: response.data.next !== null,
      has_previous: response.data.previous !== null,
    };
  }
  return null;
}

// 媒体类型
export type MediaType = 'image';

// 分类
export interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// 媒体文件
export interface Media {
  id: number;
  type: MediaType;
  type_display: string;
  file: string;
  file_url: string;
  filename: string;
  file_size: number;
  file_size_mb: number;
  mime_type: string;
  width?: number;
  height?: number;
  thumbnail?: string;
  thumbnail_url?: string;
  category?: number | null;
  category_name?: string | null;
  owner: number;
  owner_name: string;
  created_at: string;
  updated_at: string;
  // AI 分析相关
  analysis_id?: number | null;
  analysis_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | null;
  analysis_description?: string | null;
}

// 媒体分类（用于 ImageAnalysis）
export interface MediaCategory {
  id: number;
  name: string;
}

// 图片分析状态
export interface ImageAnalysis {
  id: number;
  media: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  description?: string;
  media_category?: MediaCategory | null;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  model_name: string;
  endpoint_name: string;
}

// 创建媒体请求
export interface MediaCreateRequest {
  file: File;
  filename?: string;
  category_name?: string | null;
}

// 更新媒体请求
export interface MediaUpdateRequest {
  filename?: string;
  category?: number | null;
  category_name?: string | null;
}

// ============ LLM 相关类型 ============

// LLM 提供商类型
export type LLMProviderType = 'ollama' | 'openai' | 'zhipu';

// LLM 端点
export interface LLMEndpoint {
  id: number;
  name: string;
  provider_type: LLMProviderType;
  base_url: string;
  api_key: string;
  owner: number;
  created_at: string;
  updated_at: string;
}

// LLM 模型
export interface LLMModel {
  id: number;
  endpoint: number | null;
  endpoint_name?: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ============ 项目库相关类型 ============

// 项目媒体项
export interface ProjectMedia {
  id: number;
  project: number;
  media: number;
  media_details: Media;
  order: number;
  notes?: string;
  added_at: string;
  // 兼容旧代码的别名
  filename?: string;
  file_url?: string;
  note?: string;
}

// 项目
export interface Project {
  id: number;
  name: string;
  description?: string;
  cover_image?: string;
  owner: number;
  owner_name: string;
  media_count: number;
  created_at: string;
  updated_at: string;
}

// 分页响应
export interface PaginationInfo {
  count: number;
  next: string | null;
  previous: string | null;
  page_size: number;
}

// 创建项目请求
export interface CreateProjectRequest {
  name: string;
  description?: string;
  cover_image?: string;
}

// 更新项目请求
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  cover_image?: string;
}

// 添加媒体到项目请求
export interface AddMediaRequest {
  media_ids: number[];
}

// 移除媒体请求
export interface RemoveMediaRequest {
  media_id: number;
}

// 批量移除媒体请求
export interface BatchRemoveMediaRequest {
  media_ids: number[];
}

// 重新排序媒体请求
export interface ReorderMediaRequest {
  media_orders: { id: number; order: number }[];
}

// 更新媒体备注请求
export interface UpdateMediaNotesRequest {
  media_id: number;
  note: string;
}
