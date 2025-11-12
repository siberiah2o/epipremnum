// API 客户端配置和类型定义

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface User {
  id: number
  username: string
  email: string
  avatar: string | null
}

export interface UserProfile extends User {
  phone?: string
  avatar: string | null
  created_at: string
  updated_at: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface AuthResponse {
  user: User
  refresh: string
  access: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
  password_confirm: string
  phone: string // 根据后端接口文档，手机号是必需的
}

export interface LoginData {
  email: string
  password: string
}

export interface UpdateProfileData {
  username?: string
  phone?: string
  avatar?: string
}

// API 基础配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://192.168.55.133:8888'

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  // 获取当前的 access token
  private getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token')
    }
    return null
  }

  // 获取当前的 refresh token
  private getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refresh_token')
    }
    return null
  }

  // 保存 tokens
  private saveTokens(access: string, refresh: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
    }
  }

  // 清除 tokens
  clearTokens() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
  }

  // 通用请求方法
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    // 如果需要认证，添加 Authorization header
    if (this.getAccessToken()) {
      headers.Authorization = `Bearer ${this.getAccessToken()}`
    }

    // 添加超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data: ApiResponse<T> = await response.json()

      // 处理 401 错误，尝试刷新 token
      if (response.status === 401 && this.getRefreshToken() && retryCount === 0) {
        try {
          await this.refreshToken()
          // 重试原请求
          return this.request<T>(endpoint, options, retryCount + 1)
        } catch (refreshError) {
          // 刷新失败，清除 tokens
          this.clearTokens()
          this.clearUser()
          throw new Error('登录已过期，请重新登录')
        }
      }

      if (!response.ok) {
        throw new Error(data.message || `请求失败: ${response.status}`)
      }

      return data
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('请求超时，请检查网络连接')
        }
        throw error
      }
      throw new Error('请求发生未知错误')
    }
  }

  // 用户注册
  async register(data: RegisterData): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    })

    // 保存 tokens
    if (response.data.access && response.data.refresh) {
      this.saveTokens(response.data.access, response.data.refresh)
    }

    return response
  }

  // 用户登录
  async login(data: LoginData): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify(data),
    })

    // 保存 tokens
    if (response.data.access && response.data.refresh) {
      this.saveTokens(response.data.access, response.data.refresh)
    }

    return response
  }

  // 用户登出
  async logout(): Promise<ApiResponse<null>> {
    const refreshToken = this.getRefreshToken()

    if (!refreshToken) {
      throw new Error('没有有效的 refresh token')
    }

    const response = await this.request<null>('/api/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh: refreshToken }),
    })

    // 清除 tokens
    this.clearTokens()

    return response
  }

  // 刷新 token
  async refreshToken(): Promise<ApiResponse<AuthTokens>> {
    const currentRefreshToken = this.getRefreshToken()

    if (!currentRefreshToken) {
      throw new Error('没有有效的 refresh token')
    }

    const response = await this.request<AuthTokens>('/api/auth/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh: currentRefreshToken }),
    })

    // 更新 tokens
    if (response.data.access && response.data.refresh) {
      this.saveTokens(response.data.access, response.data.refresh)
    }

    return response
  }

  // 获取当前用户基本信息
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/api/users/me/')
  }

  // 获取当前用户详细资料
  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>('/api/users/profile/')
  }

  // 更新用户资料
  async updateProfile(data: UpdateProfileData): Promise<ApiResponse<UserProfile>> {
    return this.request<UserProfile>('/api/users/update_profile/', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // 检查是否已登录
  isAuthenticated(): boolean {
    return !!this.getAccessToken()
  }

  // 获取当前保存的用户信息（如果有）
  getSavedUser(): User | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      return userStr ? JSON.parse(userStr) : null
    }
    return null
  }

  // 保存用户信息
  saveUser(user: User) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user))
    }
  }

  // 清除用户信息
  clearUser() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user')
    }
  }
}

// 创建 API 客户端实例
export const apiClient = new ApiClient(API_BASE_URL)

// 导出默认实例
export default apiClient