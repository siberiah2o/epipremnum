// AI 相关的类型定义

export interface OllamaModel {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  model_size?: string;
  is_vision_capable: boolean;
  is_active: boolean;
  is_default: boolean;
  endpoint_id: number;
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
  is_active: boolean;
  is_default: boolean;
  timeout: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateEndpointRequest {
  name: string;
  url: string;
  description?: string;
  is_default?: boolean;
  timeout?: number;
}

export type ConnectionState = "idle" | "checking" | "connected" | "failed";

export interface ModelStatistics {
  total: number;
  active: number;
  vision: number;
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}