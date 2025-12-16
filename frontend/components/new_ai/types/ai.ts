// AI 相关的类型定义

// 供应商类型
export type AIProvider = 'ollama' | 'zhipu' | 'openai' | 'azure' | 'anthropic' | 'custom';

// 认证类型
export type AuthType = 'none' | 'api_key' | 'bearer_token';

// 供应商配置
export const AI_PROVIDERS: Record<AIProvider, {
  label: string;
  requiresApiKey: boolean;
  defaultAuthType: AuthType;
  description: string;
}> = {
  ollama: {
    label: 'Ollama - 本地部署',
    requiresApiKey: false,
    defaultAuthType: 'none',
    description: '本地部署的开源大语言模型'
  },
  zhipu: {
    label: '智谱AI',
    requiresApiKey: true,
    defaultAuthType: 'api_key',
    description: ''
  },
  openai: {
    label: 'OpenAI',
    requiresApiKey: true,
    defaultAuthType: 'api_key',
    description: 'OpenAI GPT模型'
  },
  azure: {
    label: 'Azure OpenAI',
    requiresApiKey: true,
    defaultAuthType: 'api_key',
    description: 'Azure OpenAI服务'
  },
  anthropic: {
    label: 'Anthropic Claude',
    requiresApiKey: true,
    defaultAuthType: 'api_key',
    description: 'Anthropic Claude模型'
  },
  custom: {
    label: '自定义API',
    requiresApiKey: false,
    defaultAuthType: 'none',
    description: '自定义API端点'
  }
};

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
  provider?: AIProvider;  // 添加供应商字段
  created_at?: string;
  updated_at?: string;
}

export interface OllamaEndpoint {
  id: number;
  name: string;
  url: string;
  provider: AIProvider;
  provider_display?: string;
  api_key?: string;  // 只用于提交，不会返回
  has_api_key?: boolean;  // 是否已设置API Key
  auth_type: AuthType;
  auth_type_display?: string;
  description?: string;
  is_active: boolean;
  is_default: boolean;
  created_by: number;
  created_by_username: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEndpointRequest {
  name: string;
  url: string;
  provider?: AIProvider;
  api_key?: string;
  auth_type?: AuthType;
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